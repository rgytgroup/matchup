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

## Puesta en marcha (local)
1. `npm install` en la raíz.
2. Copiar `.env.example` a `apps/api/.env` y llenar las claves reales (ver checklist abajo).
3. Copiar `apps/web/.env.example` a `apps/web/.env` (por defecto apunta a `http://localhost:3000`).
4. Crear las tablas: `npm run prisma:migrate -w @matchup/api`.
5. En dos terminales: `npm run dev:api` y `npm run dev:web`.

## Estado
🚧 Fase MVP. **Flujo de auditoría cableado de punta a punta**: intake con upload →
Stripe Checkout → webhook idempotente → moderación + análisis con Gemini (validado
contra schema) → PDF → email con Resend → reporte web por slug.

Integraciones conectadas: Gemini, Supabase Storage, Stripe, Resend, PDF (pdfkit),
y Replicate (SDK conectado). Pendiente de afinar con claves/pruebas reales:
- Tier de fotos: preparación del `.zip` para el trainer LoRA y el **QC de parecido** (`TODO(qc)`).
- Cola/worker real para el pipeline (hoy corre en segundo plano tras el webhook).
- Cron de borrado de fotos a 30 días y textos legales definitivos.
