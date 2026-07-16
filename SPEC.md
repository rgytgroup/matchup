# SPEC.md — MatchUp
> Especificación técnica para Claude Code. Ponla en la raíz del repo. Complementa (no reemplaza) el plan de ejecución semanal.

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
- `Submission`: id, orderId, questionnaire (Json: goal, apps[], ageRange, city), bioText, photoUrls (String[]), status (UPLOADED|ANALYZING|DONE|FAILED), createdAt.
- `Report`: id, submissionId, resultJson (Json — ver schema §5), pdfUrl, publicSlug (acceso por link), createdAt.
- `PhotoJob`: id, orderId, provider, trainingId, status (QUEUED|TRAINING|GENERATING|QC|DONE|FAILED), outputUrls (String[]), acceptedUrls (String[]), costUsd.
- `Event`: id, type, meta (Json), createdAt — analítica interna mínima (visita checkout, compra, reembolso).

## 4. Páginas (frontend)
1. `/` Landing: promesa, ejemplos de reporte, precios visibles ($14.99 / $34.99), FAQ, CTA.
2. `/start` Intake: cuestionario (6 preguntas) → upload 3–8 fotos (drag&drop, validación de tamaño/formato) → pegar bio/prompts.
3. `/checkout` → redirige a Stripe Checkout con el tier elegido.
4. `/report/[slug]` Reporte web (accesible sin login vía slug): score global, score por foto con la foto al lado, diagnóstico de bio, 3 bios nuevas, prompts, plan de 5 pasos, botón "Download PDF". Si tier fotos: galería de fotos aceptadas con descarga.
5. `/status/[orderId]` Estado del procesamiento (polling): analizando → listo → email enviado.
6. Legal: `/terms`, `/privacy`, `/refunds` (reembolso 7 días).

## 5. Pipeline de análisis (backend)
1. Webhook `checkout.session.completed` → marca Order PAID → encola análisis.
2. Llamada a Gemini con las fotos + bio + cuestionario. **Salida JSON obligatoria con este schema:**
```json
{
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
- [ ] Reporte JSON válido en ≥95% de submissions reales de prueba (20 perfiles).
- [ ] PDF descargable idéntico al reporte web.
- [ ] Webhook de Stripe idempotente (reintento no duplica análisis).
- [ ] QC de fotos descarta automáticamente bajos parecidos.
- [ ] Landing con analítica y eventos de conversión (visita→checkout→pago).
- [ ] Lighthouse móvil ≥ 90 en landing.

## 10. Fuera de alcance v1 (NO construir aunque sea tentador)
Asistente de mensajes/chat, app nativa, cuentas con historial social, suscripciones, panel admin elaborado (con acceso a DB basta), localización ES/PT.
