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

## Estructura del monorepo (npm workspaces)
```
matchup/
├── packages/
│   └── shared/     Contrato compartido: schema zod del reporte (SPEC §5), tiers/precios, i18n
├── apps/
│   ├── api/        Backend NestJS + Prisma (módulos por dominio, webhook Stripe idempotente)
│   └── web/        Frontend React + Vite + Tailwind (router con las páginas de SPEC §4)
├── prompts/        Prompts de IA versionados (leídos en runtime, nunca hardcodeados)
└── .env.example    Variables de entorno (SPEC §7)
```

Comandos raíz: `npm install`, `npm run build`, `npm run typecheck`, `npm run dev:web`, `npm run dev:api`.

## Estado
🚧 En construcción — fase MVP (plan de ejecución de 6 semanas).
Cimientos listos (monorepo, contrato compartido, modelo de datos, esqueleto de pipelines y páginas).
Pendiente: cablear las integraciones reales (Gemini, Replicate, Stripe, Supabase, Resend) — marcadas con `TODO(...)`.
