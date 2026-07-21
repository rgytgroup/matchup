import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

/**
 * Guardián anti-screenshot (SPEC §6.0). Aplica SOLO al upload de fotos ORIGINALES
 * para generación (y al modo manual) — NUNCA al intake de perfil de §5.0, donde el
 * screenshot es el input correcto.
 *
 * Heurística barata y síncrona: las capturas de pantalla de teléfono tienen una
 * relación de aspecto muy alta (≈19.5:9, 16:9), imposible en una foto de cámara
 * (máx. 3:4 = 1.33 o 9:16 = 1.78 en vertical). Rechazamos ≥ 1.85.
 */
const SCREENSHOT_ASPECT_RATIO = 1.85;

async function looksLikeScreenshot(buffer: Buffer): Promise<boolean> {
  try {
    const { width, height } = await sharp(buffer).metadata();
    if (!width || !height) return false;
    return Math.max(width, height) / Math.min(width, height) >= SCREENSHOT_ASPECT_RATIO;
  } catch {
    // Si no se puede leer la imagen, no bloquear por este motivo (otras validaciones aplican).
    return false;
  }
}

/** Lanza 400 en la primera imagen que parezca captura de pantalla (mensaje amable). */
export async function assertNoScreenshots(files: Array<Express.Multer.File>): Promise<void> {
  for (const f of files) {
    if (await looksLikeScreenshot(f.buffer)) {
      throw new BadRequestException(
        `"${f.originalname}" looks like a screenshot. Please upload the original photo from your gallery — not a screenshot — for the best AI photos.`,
      );
    }
  }
}
