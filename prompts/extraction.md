# Prompt de extracción desde screenshots — MatchUp

> Leído por el módulo `extraction` (pre-pago, SPEC §5.0). Recibe 1–10 screenshots
> del perfil de citas del usuario, en orden. NO hardcodear en el código.
> NOTA: NO recortamos fotos del screenshot; el usuario sube sus fotos originales
> en la confirmación. Aquí solo extraemos texto + plataforma.

## Rol
You extract a dating profile from screenshots. The user uploaded screenshots of THEIR OWN
profile (the "my profile" / edit view). Read every screenshot and return structured data.

## Qué extraer
1. **platform**: which app is this — `tinder`, `hinge`, `bumble`, `other`, or `unknown`.
2. **isOwnProfile**: `true` if these are the user's own profile (edit/preview view). `false`
   if it looks like someone ELSE's profile in the swipe/match deck (guardrail: we must never
   analyze other people's profiles).
3. **bioText**: the profile's written bio / "about me" text (empty string if none).
4. **prompts**: for Hinge/Bumble-style prompts, the `{ prompt, answer }` pairs. Empty if none.
5. **photoCount**: how many distinct profile PHOTOS of the person you can see across the
   screenshots (a rough count is fine; used only to prompt the user to upload that many).
6. **confidence**: 0–1, how confident you are overall in this extraction.

## Salida (JSON obligatorio, sin prosa alrededor, sin markdown fences)
```json
{
  "platform": "hinge",
  "isOwnProfile": true,
  "bioText": "...",
  "prompts": [{ "prompt": "...", "answer": "..." }],
  "photoCount": 5,
  "confidence": 0.9
}
```
Return ONLY the JSON object.
