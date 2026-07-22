# SPEC.md — Truly (truly.dating)
> Especificación técnica para Claude Code. Ponla en la raíz del repo. Complementa (no reemplaza) el plan de ejecución semanal. (Nombre anterior del proyecto: MatchUp.)

## 1. Qué es
Web app de compra única que audita perfiles de citas: el usuario sube fotos + bio, paga, y recibe un reporte con scores, diagnóstico, bios reescritas y plan de acción. Tier premium: 30 fotos generadas con IA a partir de sus fotos.

## 2. Stack (no cambiar sin decisión explícita del dueño)
- Frontend: React 18 + Vite + Tailwind. Deploy: Vercel.
- Backend: NestJS + Prisma. Deploy: Railway.
- DB/Auth/Storage: Supabase (Postgres, auth por magic link de email, storage privado con URLs firmadas).
- IA análisis: Google Gemini (visión + texto, salida JSON con schema).
- IA fotos: Replicate (entrenamiento LoRA + generación) — abstraer tras una interfaz `PhotoProvider` para poder cambiar a fal.ai.
- Pagos: Stripe Checkout + webhooks.
- Email: Resend.
- Idioma UI v1: inglés. Todos los strings en archivo i18n desde el día 1 (ES/PT vendrán después).

## 3. Modelo de datos (Prisma)
- `User`: id, email, createdAt.
- `Order`: id, userId, tier (AUDIT | AUDIT_PLUS_PHOTOS), stripeSessionId, status (PENDING|PAID|REFUNDED), amountUsd, createdAt.
- `Submission`: id, orderId, intakeMode (SCREENSHOTS|MANUAL), screenshotUrls (String[]), extractedProfile (Json — ver §5.0: platform, bioText, prompts[], photoRefs[], confidence), questionnaire (Json: goal, ageRange, city), bioText (solo modo MANUAL), photoUrls (String[]), status (UPLOADED|EXTRACTING|CONFIRMING|ANALYZING|DONE|FAILED|NEEDS_ATTENTION), retryCount (Int, default 0), lastError (String?), createdAt.
- `Report`: id, submissionId, resultJson (Json — ver schema §5), pdfUrl, publicSlug (acceso por link), createdAt.
- `PhotoJob`: id, orderId, provider, trainingId, status (QUEUED|TRAINING|GENERATING|QC|DONE|FAILED|NEEDS_ATTENTION), outputUrls (String[]), acceptedUrls (String[]), qcScoredUrls (Json — urls ya puntuadas en QC, para reanudar sin re-puntuar), retryCount (Int, default 0), lastError (String?), costUsd.
- `Lead`: id, email, teaserScore (Int), priceShown (Decimal), variant (String?), source (String? — utm/canal), country (String? — código de país del header de Vercel, ver §12.2.2), submissionId (String?, FK opcional), convertedOrderId (String?), createdAt — lista de lanzamiento capturada por la puerta falsa (ver §12).
- `Event`: id, type, meta (Json), createdAt — analítica interna mínima (visita checkout, compra, reembolso, y los 4 eventos del embudo de §12.2).
- Nota: `retryCount`, `lastError` y los estados `NEEDS_ATTENTION` habilitan la recuperación de fallos (ver §11). `qcScoredUrls` permite reanudar el QC de fotos desde donde quedó sin re-puntuar lo ya hecho.

## 4. Páginas (frontend)
1. `/` Landing: promesa, ejemplos de reporte, precios visibles ($14.99 / $34.99), FAQ, CTA. Reglas de la landing:
   - **Un solo protagonista:** el personaje de ejemplo (hero, sample report y fotos premium) es visiblemente LA MISMA persona con el mismo nombre en toda la página — su historia completa (score inicial → diagnóstico → fotos nuevas) demuestra el producto y la promesa de "tu cara se mantiene".
   - **Prueba social solo con datos reales:** PROHIBIDO "Most chosen", contadores de clientes, o testimonios inventados mientras no existan datos que los respalden. Alternativas honestas permitidas: "Best value" / "Recommended". Cuando haya datos reales, se actualiza con la verdad.
   - **"See a sample report" abre un reporte COMPLETO navegable** (la misma vista `/report/[slug]` con datos del protagonista de ejemplo), no un fragmento — es el arma de conversión del escéptico.
   - **Paridad de especificidad:** el nivel de concreción del sample (scores por foto, "61 → 85", quick wins numerados) es el estándar mínimo del reporte real entregado; un reporte real más vago que el sample = bug de producto.
2. `/start` Intake **screenshot-first** (diseño mobile-first obsesivo — el 90% del tráfico llega desde el teléfono vía TikTok):
   - **Paso 1 — Camino principal:** "Sube screenshots de tu perfil tal como se ve en tu app" (3–10 capturas desde la galería del teléfono, selector nativo, previews inmediatos). La IA extrae todo sola (ver §5.0). Camino alterno visible pero secundario: "Prefiero ingresarlo manualmente" → upload de 3–8 fotos + pegar bio/prompts + seleccionar plataforma.
   - **Paso 2 — Confirmación de extracción (solo modo screenshots):** pantalla "Esto encontramos en tu perfil" mostrando plataforma detectada, fotos, bio y prompts extraídos, editables con un tap. Genera confianza ("me leyó el perfil") y corrige errores de extracción antes de pagar.
   - **Paso 3 — Mini-cuestionario (máx. 3 preguntas):** objetivo (relación/casual), rango de edad que busca, ciudad. REGLA: todo campo debe cambiar visiblemente el output; la plataforma NO se pregunta si se detectó del screenshot.
   - **Paso 4 →** checkout (o puerta falsa mientras los pagos no estén activos — ver §12).
   - **Upload de fotos ORIGINALES para generación (tier premium):** este es un flujo DISTINTO del intake de perfil de arriba. Cuando el usuario premium sube las fotos con las que se entrenará el LoRA, aplica el guardián anti-screenshot (§6.0). Aquí un screenshot es basura de entrada; en el intake de perfil (§5.0) un screenshot es lo correcto. No confundir los dos flujos.
3. `/checkout` → redirige a Stripe Checkout con el tier elegido.
4. `/report/[slug]` Reporte web (accesible sin login vía slug): score global, score por foto con la foto al lado, diagnóstico de bio, 3 bios nuevas, prompts, plan de 5 pasos, botón "Download PDF". Si tier fotos: galería de fotos aceptadas con descarga.
5. `/status/[orderId]` Estado del procesamiento (polling): analizando → listo → email enviado. Debe cubrir también los estados de demora/fallo con lenguaje honesto (ver §11.4) y, cuando aplique, el botón "Retry".
6. Legal: `/terms`, `/privacy`, `/refunds` (reembolso 7 días).

## 5. Pipeline de análisis (backend)

### 5.0 Extracción desde screenshots (pre-checkout, modo SCREENSHOTS)
1. Al subir screenshots → job de extracción con Gemini visión. **Salida JSON obligatoria:**
```json
{
  "platform": "tinder|hinge|bumble|other|unknown",
  "bioText": "...",
  "prompts": [{ "prompt": "...", "answer": "..." }],
  "photoCrops": [{ "screenshotIndex": 0, "boundingBox": [x, y, w, h] }],
  "confidence": 0-1
}
```
2. Recortar las fotos del perfil desde los screenshots (photoCrops) y guardarlas como photoUrls; descartar elementos de UI (botones, iconos de la app).
3. `confidence < 0.7` o extracción vacía → llevar al usuario al modo MANUAL con mensaje amable, sin callejones sin salida.
4. Mostrar pantalla de confirmación (página §4.2 paso 2); lo confirmado/corregido por el usuario es la fuente de verdad para el análisis.
5. La extracción corre ANTES del pago (es parte de la magia que convierte); su costo (~$0.02–0.05) se asume como costo de adquisición de quienes no compran.
6. Guardrail: los screenshots deben ser del PROPIO perfil del usuario ("Mi perfil" / vista de edición). Si la extracción detecta el perfil de un tercero (vista de swipe/match de otra persona) → rechazar con mensaje claro. Nunca analizar perfiles ajenos.
7. **IMPORTANTE — aquí los screenshots SÍ se esperan.** El guardián anti-screenshot (§6.0) NO aplica a este flujo: el input correcto de §5.0 es precisamente una captura del perfil de la app de citas. El guardián solo protege el upload de fotos originales para generación (§6.0).

### 5.1 Análisis (post-pago)
1. Webhook `checkout.session.completed` → marca Order PAID → encola análisis.
2. Llamada a Gemini con las fotos + bio/prompts confirmados + plataforma + cuestionario. **El análisis es consciente de la plataforma:** las bios reescritas y prompts sugeridos salen en el formato y tono de la plataforma detectada (Hinge = prompts con respuestas; Tinder = bio corta foto-primero; Bumble = señales para que ella inicie), y el reporte lo hace explícito ("Optimizado para Hinge"). **Salida JSON obligatoria con este schema:**
```json
{
  "platform": "tinder|hinge|bumble|other",
  "overallScore": 0-100,
  "photos": [{ "index": 0, "score": 0-100, "keep": true, "issues": ["..."], "strengths": ["..."] }],
  "missingArchetypes": ["social proof photo", "hobby photo"],
  "bioDiagnosis": "...",
  "rewrittenBios": ["...", "...", "..."],
  "suggestedPrompts": [{ "prompt": "...", "answer": "..." }],
  "actionPlan": ["paso 1", "..5 pasos.."]
}
```
2b. **IDIOMA DE SALIDA FORZADO (aprendizaje de producción — el teaser salió en español dentro de una UI en inglés):** todo el texto generado por IA (diagnóstico, fortalezas del teaser, explicaciones, plan) sale SIEMPRE en el idioma de la UI (inglés v1), sin importar el idioma del perfil analizado. Se instruye explícito en el prompt (`/prompts/`): "Respond ONLY in {uiLanguage}, regardless of the language of the profile content." EXCEPCIÓN deliberada: las bios y prompts REESCRITOS se entregan en el idioma del perfil original (el usuario los pegará en SU app), pero toda la explicación alrededor va en {uiLanguage}. Cuando existan UI ES/PT, {uiLanguage} sigue el locale.
3. Validar el JSON contra schema (zod); si falla, 1 reintento con el error como feedback; si falla de nuevo → status FAILED + alerta al admin.
4. Generar PDF del reporte (server-side), subir a storage, email al usuario con link.
- Los prompts de Gemini viven en `/prompts/*.md` versionados en git — NUNCA hardcodeados en el código.

## 6. Pipeline de fotos (tier premium)

### 6.0 Guardián anti-screenshot (validación de entrada — CRÍTICO para calidad y margen)
Aprendizaje de producción: entrenar el LoRA con screenshots de la galería (barra de estado, UI de Google Fotos, cara pequeña) produce un modelo débil → baja tasa de aprobados en QC y créditos de Replicate/Gemini quemados en un LoRA inservible. Y los clientes reales subirán screenshots por costumbre igual que le pasó al dueño dos veces.
- Al subir fotos ORIGINALES para generación (y en el modo MANUAL del §4.2), validar CADA imagen ANTES de aceptarla:
  - Detectar señales de screenshot: relación de aspecto típica de pantalla de teléfono, barra de estado (hora/batería/señal), elementos de UI (botones, iconos de apps, barras de navegación).
  - Si parece screenshot → rechazar esa imagen con mensaje amable: "Esto parece una captura de pantalla — sube la foto original desde tu galería para mejores resultados." Permitir reintentar con el archivo correcto.
- La validación ocurre en el UPLOAD, antes de entrenar nada — nunca se entrena un LoRA con imágenes rechazadas. Esto protege la calidad Y los créditos.
- ALCANCE: aplica SOLO a fotos originales para generación y al modo manual. NO aplica al intake de perfil de §5.0, donde el screenshot es el input correcto (ver §5.0.7).

### 6.1 Generación
1. Entrenar LoRA con las fotos del usuario (Replicate). Guardar trainingId y costo.
2. Generar 40–60 imágenes en 6–8 escenarios (plantillas de prompt en `/prompts/photo-scenarios.md`).

### 6.2 QC automático
3. Pase de visión que puntúa parecido facial vs fotos originales; descartar < umbral; entregar las 30 mejores. Guardar las urls ya puntuadas en `PhotoJob.qcScoredUrls` para poder reanudar sin re-puntuar (ver §11).
4. Si tras QC hay <20 aceptables → regenerar una tanda; si sigue mal → email al admin para revisión manual (no entregar basura).

### 6.3 Reglas del QC de parecido (afinamiento — evitar falsos positivos)
Aprendizaje de producción: el QC dejó pasar una foto de grupo sin protagonista claro (falso positivo). El QC no solo mide "parecido", primero valida que la imagen sea utilizable como foto de perfil individual:
- Rechazar SIEMPRE (antes de puntuar parecido): imágenes con más de una persona prominente / sin un rostro individual claro y dominante; rostro no reconocible (contraluz fuerte, muy pequeño, cortado, de espaldas); artefactos de IA evidentes (manos/orejas/dientes deformes, rasgos derretidos).
- Solo tras pasar ese filtro se puntúa el parecido facial vs las fotos originales.
- El umbral de parecido y el prompt de QC viven en `/prompts/photo-scenarios.md` (o archivo QC dedicado), versionados — ajustables sin tocar código.

- **Costo/consumo:** el QC llama a Gemini una vez por imagen candidata (~40–80 llamadas por orden premium, además del análisis). Es el mayor consumidor de créditos Gemini del sistema. Vigilar (ver §11.5) y, cuando convenga, optimizar (puntuar en lote, o usar un modelo más barato para el QC de parecido).

## 7. Variables de entorno
`DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_API_KEY, REPLICATE_API_TOKEN, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, APP_BASE_URL, ADMIN_TOKEN, FAKE_DOOR_ENABLED, PRICE_AB_ENABLED`

## 8. Reglas de negocio y guardrails
- Compra única. PROHIBIDO introducir suscripciones, timers falsos de descuento o dark patterns — la honestidad es el posicionamiento.
- Fotos del usuario: borrado automático a 30 días (cron). Los reportes permanecen.
- Reembolso: botón/email simple; marcar REFUNDED y detener cualquier job activo.
- Nunca generar fotos que alteren rasgos físicos (etnia, cuerpo, edad); los escenarios cambian contexto/ropa/luz, no la persona.
- Rechazar submissions con fotos de menores o de terceros evidentes (pase de moderación con visión antes de analizar).
- No entrenar LoRA con screenshots (ver §6.0): protege calidad del producto y créditos.
- Todo texto de salida al usuario pasa por el idioma del archivo i18n.
- **Regla de oro de entrega (ver §11):** un `Order` en estado PAID SIEMPRE termina en el entregable pagado (reporte, y fotos si es premium), cueste los reintentos que cueste. El cliente NUNCA re-paga por un fallo nuestro y NUNCA queda en un limbo sin respuesta.
- **Honestidad en la validación (ver §12):** la puerta falsa nunca pide datos de tarjeta ni simula un cobro; declara con transparencia que los pagos aún no están activos.

## 9. Criterios de aceptación del MVP (definition of done)
- [ ] Flujo completo pago→análisis→reporte→email sin intervención manual.
- [ ] Intake screenshot-first: extracción correcta (plataforma + bio + fotos) en ≥85% de screenshots reales de prueba de Tinder, Hinge y Bumble; fallback a manual sin callejones sin salida.
- [ ] Pantalla de confirmación editable funcionando en móvil (tap para corregir).
- [ ] Reporte adaptado a la plataforma detectada (verificar con 3 perfiles: uno por plataforma).
- [ ] Reporte JSON válido en ≥95% de submissions reales de prueba (20 perfiles).
- [ ] Salida de IA siempre en el idioma de la UI (§5.1.2b): probar con un perfil en español y UI en inglés — cero texto mezclado en teaser y reporte (salvo bios/prompts reescritos, que van en el idioma del perfil).
- [ ] Vista previa bloqueada (§12.1.2b): renderiza la estructura del reporte real y el contenido cubierto NO es recuperable desde el navegador (verificar con inspeccionar elemento y respuesta de red).
- [ ] Conteo dinámico: filas de "Problem #N" en la vista bloqueada = conteo del teaser = conteo del `resultJson` (probar con análisis de 3 y de 5 problemas).
- [ ] CTA sticky visible en móvil durante todo el scroll del reporte bloqueado.
- [ ] País capturado en los 4 eventos del embudo y en `Lead` (verificar que llega el código de país y que NO se almacena la IP).
- [ ] Botón de compartir prominente (§12.3.1): jerarquía visual de botón, no de link.
- [ ] PDF descargable idéntico al reporte web.
- [ ] Webhook de Stripe idempotente (reintento no duplica análisis).
- [ ] Guardián anti-screenshot (§6.0): rechaza screenshots en el upload de fotos originales/modo manual; NO se dispara en el intake de perfil de §5.0.
- [ ] QC de fotos: rechaza fotos de grupo/sin rostro individual claro (§6.3) antes de puntuar parecido, y descarta bajos parecidos.
- [ ] Generación premium con fotos reales (no screenshots): ≥20 de ~60 aceptadas en QC, y validación visual humana de que ≥8–10 son usables sin dudar (define si el tier $34.99 se lanza).
- [ ] Puerta falsa e instrumentación (§12) completas y verificadas ANTES del primer visitante desconocido.
- [x] Recuperación de fallos (§11): un Order PAID que falla en análisis o fotos se recupera vía reintento automático idempotente, botón "Retry" del cliente o re-encolado admin, SIN re-cobro y SIN re-entrenar el LoRA; reanuda desde el último paso exitoso. Verificado en prod: reintento auto 3x → NEEDS_ATTENTION con retryCount/lastError; botón Retry re-encola solo lo pendiente (`actions:["photos"]`), conserva el trainingId. (Pendiente §11.5: alerta de presupuesto en Google Cloud para no volver a agotar créditos Gemini en silencio.)
- [x] Landing con analítica y eventos de conversión (visita→checkout→pago) verificados disparando en producción.
- [ ] QA completo en teléfono real (no solo responsive del navegador): hero sin romperse, CTAs cómodos al pulgar, carga rápida en red móvil, flujo de subir screenshots desde la galería fluido.
- [x] Landing cumple las reglas de §4.1 (protagonista único, cero prueba social inventada, sample report completo navegable). Sample report completo en `/sample` (mismo `ReportView` que el reporte real → paridad garantizada); protagonista único "Mateo" en héroe, sample y fotos premium; ribbon "Best value" (sin prueba social inventada).
- [ ] Lighthouse móvil ≥ 90 en landing.

## 10. Fuera de alcance v1 (NO construir aunque sea tentador)
Asistente de mensajes/chat, app nativa, cuentas con historial social, suscripciones, panel admin elaborado (con acceso a DB basta), localización ES/PT.

## 11. Recuperación de fallos (post-pago)
El pago y el procesamiento están desacoplados: Stripe cobra una vez y marca el Order PAID; el análisis y las fotos se disparan por estado + cola de trabajos, NUNCA por un pago nuevo. Por tanto re-ejecutar cualquier trabajo es gratis por diseño y jamás genera un segundo cargo. Esta sección define cómo un fallo posterior al pago SIEMPRE termina en entrega.

### 11.1 Principio (regla de oro)
Un `Order` PAID que falla a mitad de camino es responsabilidad nuestra (créditos agotados, timeout, 429, etc.), no del cliente. La recuperación es automática y gratuita para él. El cliente pagó por un RESULTADO, no por un INTENTO.

### 11.2 Idempotencia y reanudación (obligatorio)
Todo job de recuperación reanuda desde el último paso exitoso; nunca reinicia desde cero ni duplica trabajo ya hecho ni re-cobra créditos innecesarios:
- **Análisis:** si el reporte ya existe (Report con ese submissionId), no se regenera; si faltaba solo el PDF/email, se retoma ahí.
- **Fotos:** verificar `PhotoJob.trainingId` — si el LoRA ya está entrenado, NO re-entrenar (es lo caro). Si las imágenes ya se generaron y faltó el QC, reanudar el QC usando `qcScoredUrls` para no re-puntuar las ya evaluadas. Reanudar cuesta centavos.

### 11.3 Reintentos automáticos con tope
- Errores transitorios (429, timeouts, 5xx de Gemini/Replicate) → reintento automático con backoff exponencial, máximo **3 intentos**, incrementando `retryCount`.
- Tras 3 intentos fallidos → estado `NEEDS_ATTENTION` + alerta a Sentry con `orderId` y `lastError`. NUNCA un bucle infinito (protege créditos ante fallos estructurales: foto corrupta, prompt siempre fallido, etc.).

### 11.4 Recuperación asistida
- **Botón "Retry" del cliente** en `/status/[orderId]` (y en `/report/[slug]` si aplica) cuando el estado es FAILED/NEEDS_ATTENTION → re-encola el job de forma idempotente (§11.2). Sin cobro, sin duplicación.
- **Endpoint de admin** (protegido con `ADMIN_TOKEN`) para re-disparar cualquier Order por `orderId` con una llamada. Es la herramienta del dueño mientras el volumen sea bajo; sustituye a tocar la DB a mano.
- **Mensaje honesto en `/status`** en vez de error crudo o silencio. Ej.: "We're still generating your photos — this one is taking a little longer than usual. We'll email you the moment it's ready." Nunca se le muestra al cliente un stack trace ni se le deja sin señal.

### 11.5 Guardas de billing (causa raíz del primer fallo real)
- Configurar alerta de presupuesto en Google Cloud/AI Studio que avise por correo al bajar de un umbral de créditos Gemini. Nunca enterarse del saldo agotado por un cliente.
- Configurar auto-reload CON TOPE mensual en Replicate y Gemini: nunca se agota a mitad de una orden real, pero un bug o abuso no vacía la tarjeta.
- Vigilar el consumo del QC de fotos (§6): es el mayor gasto de Gemini por orden. Registrar `PhotoJob.costUsd` real por orden para detectar desviaciones.

### 11.6 Economía unitaria verificada (julio 2026, datos reales de prueba)
Costo por orden PREMIUM ($34.99): Gemini ~$0.70 + Replicate ~$0.70 + Stripe ~$1.31 = ~$2.71 → margen bruto ~92%. Orden AUDIT ($14.99): ~$1.05 → margen ~93%. El modelo cuadra con holgura; el QC de fotos es la palanca de optimización si algún día el volumen aprieta (no antes).

## 12. Validación pre-lanzamiento y adquisición orgánica (fake door)

**Contexto y razón de existir:** el producto está construido pero NO se puede cobrar todavía — la LLC (New Mexico) se crea el 28 de julio y la ruta LLC → EIN → banco → Stripe deja los pagos activos a mediados de agosto. En vez de esperar ~3 semanas sin datos, se lanza con una **puerta falsa**: se mide intención de compra real con tráfico real y se construye una lista de correos para convertir el día que Stripe esté vivo.

**Principio innegociable:** la puerta falsa es transparente, no engañosa. NUNCA se pide dato de tarjeta, NUNCA se simula un cobro, y el mensaje post-clic dice la verdad ("estamos habilitando los pagos"). La honestidad es el posicionamiento del producto (§8) y eso aplica también a cómo se valida.

### 12.1 Pantalla de puerta falsa (teaser + captura de intención)

Flujo: el usuario completa el intake (§4.2) → recibe GRATIS un teaser de su análisis → en el pico de curiosidad se muestra precio y CTA → el clic captura correo, no dinero.

- [ ] **12.1.1 — Teaser gratuito post-análisis.** Ejecutar el análisis real (§5.1) y mostrar solo:
  - Score global (ej. "6.2/10").
  - **Una fortaleza real y específica** extraída del análisis (no genérica: debe citar algo concreto de SU perfil).
  - **Conteo de problemas detectados SIN revelarlos**: "Detectamos 3 problemas que están espantando tus matches."
  - Copy placeholder (EN): *"Your profile scored 6.2/10. Your first photo is genuinely strong — sharp, warm, real eye contact. But we found 3 problems that are pushing matches away. They're all fixable."*
  - REGLA: el conteo de problemas debe ser REAL (sale del `resultJson`), nunca un número inventado.
- [ ] **12.1.2 — Bloque de precio + CTA.** Debajo de la vista bloqueada (12.1.2b): precio visible y botón de desbloqueo.
  - Copy placeholder (EN): botón *"Unlock my full report — $14.99"*.
  - El bloque premium ($34.99) se muestra como segunda opción, igual que en §4.1.
- [ ] **12.1.2b — Vista previa BLOQUEADA del reporte (mostrar, no describir).** Entre el teaser y el CTA, renderizar la estructura del reporte real del usuario con su contenido cubierto: filas "Photo 1/2/3" con barras de score difuminadas + candado 🔒, "Problem #1/#2/#3" con texto tapado, y el inicio de una bio reescrita difuminada. Reutilizar el MISMO componente `ReportView` con overlay de bloqueo — cero componentes nuevos.
  - Razón: el usuario no debe *leer* que existe un reporte; debe *verlo* a un pago de distancia (patrón de paywall estándar: la vista bloqueada convierte más que la lista de beneficios). La lista textual actual bajo el CTA ("full photo-by-photo scores...") queda subordinada o se elimina — el texto describe, la vista vende.
  - REGLA DE SEGURIDAD: el contenido bloqueado NO viaja al navegador. No basta CSS blur sobre texto real en el DOM (se lee con inspeccionar elemento). El servidor entrega la estructura con placeholders/imagen difuminada; el contenido real solo se sirve tras el desbloqueo.
  - REGLA DE COHERENCIA: el número de filas "Problem #N" renderizadas en la vista bloqueada = el conteo REAL del `resultJson`, el mismo que anuncia el teaser. Si el análisis da 3 problemas, se muestran 3 filas; nunca un número fijo de filas decorativas.
  - **CTA sticky en móvil:** el botón "Unlock" flota fijo en la parte baja de la pantalla mientras el usuario scrollea el reporte bloqueado (el 90% del tráfico es móvil; el momento de impulso no puede quedar a tres pantallas del botón). En desktop basta el CTA al final + opcionalmente repetido tras el teaser.
- [ ] **12.1.3 — Modal de captura post-clic (NO cobra).** Al hacer clic en el CTA se abre un modal transparente:
  - Copy placeholder (EN): *"We're switching payments on right now. Leave your email and you'll be among the first in — with 30% off at launch."*
  - Campo de email + botón. Confirmación clara tras enviar ("You're on the list — we'll email you the moment it's live").
  - PROHIBIDO: pedir número de tarjeta, CVV, dirección de facturación o cualquier dato de pago. PROHIBIDO simular una pasarela.
- [ ] **12.1.4 — Modelo de datos.** Nueva tabla `Lead`: id, email, teaserScore (Int), priceShown (Decimal — para el A/B de §12.1.5), variant (String?), source (String? — utm/canal), submissionId (FK, opcional), createdAt, convertedOrderId (String?, se llena cuando compre de verdad).
- [ ] **12.1.5 — A/B test de precio (opcional, activable por flag).** Mostrar dos precios distintos a mitades del tráfico (ej. $14.99 vs $19.99) para descubrir disposición a pagar. La variante mostrada se persiste en `Lead.priceShown` y `Lead.variant`.
  - REGLA DE HONESTIDAD: quien dejó su correo viendo un precio recibe ESE precio (con su 30%) cuando se abran los pagos. El A/B mide disposición, no sirve para cobrar de más después.

**Criterios de aceptación (12.1):**
- [ ] El teaser muestra una fortaleza específica del perfil real del usuario y un conteo de problemas derivado del `resultJson`, no textos fijos.
- [ ] El clic en el CTA nunca inicia un flujo de pago ni solicita datos de tarjeta.
- [ ] El correo queda persistido en `Lead` con score, precio mostrado y fuente, y es exportable en CSV.
- [ ] El mensaje post-clic declara con claridad que los pagos aún no están activos.

### 12.2 Instrumentación (BLOQUEANTE — antes del primer visitante)

Sin esto, el tráfico se desperdicia: no se puede aprender de visitantes que no se midieron.

- [ ] **12.2.1 — Cuatro eventos obligatorios** en `Event` (§3) y en la analítica del front:
  1. `visit` — llegó a la landing.
  2. `teaser_viewed` — completó el intake y vio su teaser.
  3. `unlock_clicked` — hizo clic en el botón de compra (**métrica de intención — la más importante**).
  4. `email_captured` — dejó su correo.
- [ ] **12.2.2 — Metadatos por evento:** fuente/UTM, variante de precio, dispositivo (móvil/escritorio), **país** (del header `x-vercel-ip-country` del lado del servidor — NUNCA almacenar la IP cruda, solo el código de país), timestamp. El país también se guarda en `Lead.country` al capturar el correo. Objetivo: poder responder "¿de qué países hacen clic en comprar?", no solo "¿de dónde me visitan?" — la intención por país decide dónde apuntar ads e idiomas.
- [ ] **12.2.3 — Vista de embudo** (puede ser una consulta SQL o una página admin mínima) que muestre los 4 pasos con % de conversión entre cada uno.

**Métricas clave y umbrales de decisión:**
| Métrica | Cálculo | Lectura |
|---|---|---|
| **Intención de compra** | `unlock_clicked` / `visit` | **≥3-5% con tráfico frío = señal fuerte** (validado, listo para ads). 1-3% = zona gris, iterar teaser/promesa. **<1% = NO pagar ads todavía**: corregir promesa, gancho o teaser primero. |
| **Captura de correo** | `email_captured` / `unlock_clicked` | Mide qué tan bien convierte el modal. <40% → revisar copy del modal. |
| **Completitud del intake** | `teaser_viewed` / `visit` | Si es baja, el problema es fricción en §4.2, no la oferta. |

**Criterios de aceptación (12.2):**
- [ ] Los 4 eventos disparan verificados en producción (probados end-to-end desde un dispositivo real).
- [ ] El embudo es consultable sin tocar código.
- [ ] Ningún visitante llega a la puerta falsa antes de que 12.2 esté completo.

### 12.3 Botón de compartir (viralidad orgánica)

- [ ] **12.3.1** — En la pantalla del teaser, botón "Share my score" como **botón secundario visible y prominente** (estilo outline junto al CTA principal), NO un link de texto pequeño. El momento de compartir es AHORA: quien acaba de sacar 4.8/10 está en el instante exacto de mandárselo al grupo de amigos; un link tímido desperdicia ese momento.
  - Copy placeholder (EN): *"My dating profile scored 6.2/10 😬 — get yours: truly.dating"*.
  - Usar Web Share API en móvil (nativo) con fallback a copiar-al-portapapeles en escritorio.
- [ ] **12.3.2** — El link compartido lleva UTM propio (`source=share`) para medir cuánto tráfico genera.
- [ ] **12.3.3** — PRIVACIDAD: el compartido incluye SOLO el score numérico. Nunca fotos, bio, ni ningún dato del perfil del usuario.

**Criterios de aceptación (12.3):**
- [ ] Compartir funciona en iOS y Android desde el navegador.
- [ ] El tráfico entrante por `source=share` aparece diferenciado en el embudo.

### 12.4 Plan de adquisición orgánica (hasta el 28 de julio, presupuesto $0)

**Meta: 100-300 visitantes desconocidos (no amigos) antes del 28 de julio.**

- [ ] **12.4.1 — TikTok diario (canal principal).** 1 video/día en inglés:
  - Formato: grabación de pantalla de Truly analizando un perfil real (con permiso) + gancho de texto grande en los primeros 2 segundos + subtítulos. Editado en CapCut (gratis). Sin cámara, sin producción, sin aparecer en pantalla.
  - Ganchos placeholder: *"This profile gets zero matches. Here's why."* / *"I let an AI roast my dating profile."* / *"Your first photo is the only one that matters — here's proof."*
  - Link en bio (TikTok no permite links en el video).
  - Publicar el MISMO video en Reels y Shorts (triple alcance, cero trabajo extra).
- [ ] **12.4.2 — Reddit (2-3 hilos/día).** En r/Tinder, r/hingeapp, r/OnlineDating: responder hilos de "roast my profile" con análisis genuinos y útiles.
  - REGLA ANTI-SPAM: **no pegar el link en los comentarios.** El link va en el perfil de Reddit. El valor del comentario es lo que hace que la gente entre al perfil. Respetar las reglas de cada subreddit.
- [ ] **12.4.3 — Directorios de herramientas IA (una sola tarde).** Enviar Truly a directorios de productos/herramientas de IA. Tarea única, no recurrente.
- [ ] **12.4.4 — Registro de canal.** Cada canal usa su propio UTM (`tiktok`, `reddit`, `directory`, `share`) para saber cuál trae tráfico que realmente hace clic en comprar — no solo visitas.

**Criterios de aceptación (12.4):**
- [ ] ≥100 visitantes únicos desconocidos antes del 28/jul, con fuente identificada.
- [ ] Al menos 7 videos publicados en los 3 canales de video.
- [ ] Cero advertencias o baneos por spam en Reddit.

### 12.5 Calendario de ejecución

| Cuándo | Qué | Objetivo |
|---|---|---|
| **Esta semana** | Puerta falsa (12.1) + instrumentación (12.2) + botón compartir (12.3) | Todo listo ANTES del primer visitante |
| **Hasta el 28/jul** | Solo tráfico orgánico: TikTok diario + Reddit + directorios (12.4) | 100-300 visitantes, primer dato de intención |
| **Desde el 28/jul** (LLC creada) | Ads $5-10 USD/día, 2-3 creativos de prueba, apuntando a la MISMA puerta falsa | **Objetivo: datos y correos, NO facturar todavía.** Comparar intención de tráfico pago vs orgánico |
| **Mediados de agosto** (Stripe activo) | Email a toda la lista de `Lead` con el 30% prometido | **Primeras ventas reales** |

**Regla de decisión antes de gastar en ads (28/jul):** si la intención (`unlock_clicked`/`visit`) del tráfico orgánico va **<1%**, NO se encienden los ads — primero se corrige la promesa/teaser. Pagar por tráfico hacia una oferta que no convierte es quemar plata.

### 12.6 Cierre de la puerta falsa (cuando Stripe esté vivo)

- [ ] Reemplazar el modal de captura por el checkout real de Stripe (§4.3).
- [ ] Enviar a toda la lista de `Lead` el correo con su descuento del 30% sobre el precio que se le mostró (§12.1.5).
- [ ] Marcar `Lead.convertedOrderId` cuando un lead compre, para medir la tasa de conversión real de la lista.
- [ ] Registrar en este SPEC la métrica final: % de intención medida en fake door vs % de compra real. Es el dato más valioso para futuros productos del estudio.