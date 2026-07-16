# MatchUp

Auditoría honesta de perfiles de citas con IA: reporte con scores, diagnóstico, bios reescritas y plan de acción; tier premium con fotos generadas por IA. Compra única, sin suscripciones.

Producto de **rgytgroup**.

## Documentos clave
- `SPEC.md` — especificación técnica completa (stack, modelo de datos, páginas, pipelines, guardrails, criterios de aceptación). **Leer antes de tocar código.**
- `CLAUDE.md` — reglas de trabajo para sesiones con Claude Code.
- `.env.example` — variables de entorno requeridas (los valores reales nunca van al repo).

## Stack
React + Vite + Tailwind (Vercel) · NestJS + Prisma (Railway) · Supabase · Gemini · Replicate · Stripe · Resend

## Cómo trabajar en este repo
1. Copiar `.env.example` a `.env` y llenar valores (pedir acceso al gestor de secretos).
2. Abrir Claude Code en la raíz: leerá `CLAUDE.md` automáticamente.
3. Pedir tareas referenciando el plan de ejecución y el SPEC, por ejemplo:
   `"Implementa la página /start (SPEC §4.2) con upload de fotos y cuestionario."`

## Estado
🚧 En construcción — fase MVP (plan de ejecución de 6 semanas).
