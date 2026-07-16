/**
 * Interfaz del proveedor de fotos IA (SPEC §2: abstraer Replicate para poder
 * cambiar a fal.ai sin tocar el resto del código).
 */
export const PHOTO_PROVIDER = Symbol('PHOTO_PROVIDER');

export interface TrainingResult {
  trainingId: string;
  costUsd?: number;
}

export interface GenerationResult {
  imageUrls: string[];
  costUsd?: number;
}

export interface PhotoProvider {
  /** Entrena un LoRA con las fotos del usuario. */
  train(photoUrls: string[]): Promise<TrainingResult>;
  /** Genera imágenes a partir del modelo entrenado y una lista de prompts. */
  generate(trainingId: string, prompts: string[]): Promise<GenerationResult>;
}
