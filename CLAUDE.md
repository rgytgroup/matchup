# CLAUDE.md — MatchUp

Instrucciones permanentes para Claude Code en este repositorio. Léelas al inicio de cada sesión.

## Antes de cualquier tarea
1. Lee `SPEC.md` completo. Es el contrato del producto.
2. Respeta sin excepción: el stack (SPEC §2), los guardrails de negocio (SPEC §8) y el fuera de alcance (SPEC §10). Si una tarea parece requerir violar alguno, DETENTE y pregunta al dueño en lugar de improvisar.

## Reglas de trabajo
- Los prompts de IA (Gemini, Replicate) viven en `/prompts/*.md`, versionados en git. NUNCA hardcodees prompts en el código; el código los lee de esos archivos.
- Toda salida de IA se valida contra schema con zod (ver schema en SPEC §5). Si el JSON no valida: 1 reintento con el error como feedback, luego status FAILED.
- Secretos SOLO en variables de entorno (ver `.env.example`). Nunca en el código, nunca en commits, nunca en logs.
- Los webhooks de Stripe deben ser idempotentes: procesar el mismo evento dos veces no puede duplicar análisis, emails ni jobs de fotos.
- Strings de UI en el archivo i18n desde el día 1 (inglés v1; ES/PT vendrán después).
- Commits pequeños y descriptivos en español. Una tarea del plan = una rama o un commit coherente.

## Estilo técnico
- TypeScript estricto en front y back.
- NestJS: módulos por dominio (orders, submissions, analysis, photos, reports).
- Prisma como única capa de acceso a datos.
- Manejo de errores explícito: nada de catch vacíos; errores de pipeline → estado FAILED + registro en Event.

## Qué NO hacer aunque parezca buena idea
- No agregar suscripciones, timers de descuento, ni dark patterns (la honestidad es el posicionamiento del producto).
- No agregar dependencias pesadas sin justificación; preferir lo que ya está en el stack.
- No construir panel de administración elaborado, asistente de mensajes/chat, ni app nativa (SPEC §10).
- No alterar rasgos físicos de las personas en la generación de fotos; los escenarios cambian contexto, no la persona.

## Definición de terminado
Una tarea está terminada cuando cumple su criterio de aceptación (SPEC §9 cuando aplique), compila sin warnings de TypeScript, y el flujo afectado se probó end-to-end en local.
