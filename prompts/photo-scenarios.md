# Escenarios de generación de fotos (tier premium) — MatchUp

> Leído por el módulo `photos` para la generación tras el entrenamiento LoRA (SPEC §6).
> NO hardcodear en el código. El token de identidad del sujeto entrenado se inserta como `{{subject}}`.

## Regla inviolable (SPEC §8)
Los escenarios cambian **contexto, ropa, luz y encuadre** — NUNCA rasgos físicos de la persona
(etnia, cuerpo, edad, rostro). Prohibido "embellecer" alterando la identidad. El objetivo es
mostrar a la MISMA persona en mejores situaciones, no a otra persona.

## Objetivo
Generar 40–60 imágenes repartidas en 6–8 escenarios; tras QC de parecido facial se entregan las 30 mejores.

## Escenarios base
Cada bloque es una plantilla; `{{subject}}` = token del sujeto entrenado.

1. **Clean headshot** — `a natural, well-lit portrait photo of {{subject}}, soft daylight, plain background, genuine relaxed smile, sharp focus, shot on 50mm`
2. **Outdoor candid** — `candid photo of {{subject}} walking outdoors in a city park, golden hour, natural expression, shallow depth of field`
3. **Hobby / activity** — `photo of {{subject}} engaged in an outdoor activity (hiking / cycling / cooking), authentic moment, natural lighting`
4. **Social / friends context** — `photo of {{subject}} at a relaxed social setting like a rooftop or cafe, warm ambient light, looking approachable` (sin generar terceros reconocibles)
5. **Smart-casual full body** — `full-body photo of {{subject}} in smart-casual outfit, standing in an interesting urban location, daylight`
6. **Travel** — `photo of {{subject}} at a scenic travel location, natural daylight, casual outfit, authentic tourist-but-stylish vibe`
7. **Evening / dressed up** — `photo of {{subject}} dressed up for an evening out, tasteful indoor lighting, confident relaxed posture`
8. **Pet / prop (opcional)** — `photo of {{subject}} with a friendly dog in a park, warm natural light, genuine laugh`

## Negativos comunes (aplicar a todos)
`deformed hands, extra fingers, distorted face, altered facial features, different person, oversaturated, plastic skin, watermark, text`
