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
- `Submission`: id, orderId, intakeMode (SCREENSHOTS|MANUAL), screenshotUrls (String[]), extractedProfile (Json — ver §5.0: platform, bioText, prompts[], photoRefs[], confidence), questionnaire (Json: goal, ageRange, city), bioText (solo modo MANUAL), photoUrls (String[]), status (UPLOADED|EXTRACTING|CONFIRMING|ANALYZING|DONE|FAILED), createdAt.
- `Report`: id, submissionId, resultJson (Json — ver schema §5), pdfUrl, publicSlug (acceso por link), createdAt.
- `PhotoJob`: id, orderId, provider, trainingId, status (QUEUED|TRAINING|GENERATING|QC|DONE|FAILED), outputUrls (String[]), acceptedUrls (String[]), costUsd.
- `Event`: id, type, meta (Json), createdAt — analítica interna mínima (visita checkout, compra, reembolso).

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
   - **Paso 4 →** checkout.
3. `/checkout` → redirige a Stripe Checkout con el tier elegido.
4. `/report/[slug]` Reporte web (accesible sin login vía slug): score global, score por foto con la foto al lado, diagnóstico de bio, 3 bios nuevas, prompts, plan de 5 pasos, botón "Download PDF". Si tier fotos: galería de fotos aceptadas con descarga.
5. `/status/[orderId]` Estado del procesamiento (polling): analizando → listo → email enviado.
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
3. Validar el JSON contra schema (zod); si falla, 1 reintento con el error como feedback; si falla de nuevo → status FAILED + alerta al admin.
4. Generar PDF del reporte (server-side), subir a storage, email al usuario con link.
- Los prompts de Gemini viven en `/prompts/*.md` versionados en git — NUNCA hardcodeados en el código.

## 6. Pipeline de fotos (tier premium)
1. Entrenar LoRA con las fotos del usuario (Replicate). Guardar trainingId y costo.
2. Generar 40–60 imágenes en 6–8 escenarios (plantillas de prompt en `/prompts/photo-scenarios.md`).
3. QC automático: pase de visión que puntúa parecido facial vs fotos originales; descartar < umbral; entregar las 30 mejores.
4. Si tras QC hay <20 aceptables → regenerar una tanda; si sigue mal → email al admin para revisión manual (no entregar basura).

## 7. Variables de entorno
`DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_API_KEY, REPLICATE_API_TOKEN, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, APP_BASE_URL`

## 8. Reglas de negocio y guardrails
- Compra única. PROHIBIDO introducir suscripciones, timers falsos de descuento o dark patterns — la honestidad es el posicionamiento.
- Fotos del usuario: borrado automático a 30 días (cron). Los reportes permanecen.
- Reembolso: botón/email simple; marcar REFUNDED y detener cualquier job activo.
- Nunca generar fotos que alteren rasgos físicos (etnia, cuerpo, edad); los escenarios cambian contexto/ropa/luz, no la persona.
- Rechazar submissions con fotos de menores o de terceros evidentes (pase de moderación con visión antes de analizar).
- Todo texto de salida al usuario pasa por el idioma del archivo i18n.

## 9. Criterios de aceptación del MVP (definition of done)
- [ ] Flujo completo pago→análisis→reporte→email sin intervención manual.
- [ ] Intake screenshot-first: extracción correcta (plataforma + bio + fotos) en ≥85% de screenshots reales de prueba de Tinder, Hinge y Bumble; fallback a manual sin callejones sin salida.
- [ ] Pantalla de confirmación editable funcionando en móvil (tap para corregir).
- [ ] Reporte adaptado a la plataforma detectada (verificar con 3 perfiles: uno por plataforma).
- [ ] Reporte JSON válido en ≥95% de submissions reales de prueba (20 perfiles).
- [ ] PDF descargable idéntico al reporte web.
- [ ] Webhook de Stripe idempotente (reintento no duplica análisis).
- [ ] QC de fotos descarta automáticamente bajos parecidos.
- [ ] Landing con analítica y eventos de conversión (visita→checkout→pago) verificados disparando en producción.
- [ ] QA completo en teléfono real (no solo responsive del navegador): hero sin romperse, CTAs cómodos al pulgar, carga rápida en red móvil, flujo de subir screenshots desde la galería fluido.
- [ ] Landing cumple las reglas de §4.1 (protagonista único, cero prueba social inventada, sample report completo navegable).
- [ ] Lighthouse móvil ≥ 90 en landing.

## 10. Fuera de alcance v1 (NO construir aunque sea tentador)
Asistente de mensajes/chat, app nativa, cuentas con historial social, suscripciones, panel admin elaborado (con acceso a DB basta), localización ES/PT.