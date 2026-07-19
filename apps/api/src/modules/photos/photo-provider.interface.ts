/**
 * Interfaz del proveedor de fotos IA (SPEC §2: abstraer Replicate para poder
 * cambiar a fal.ai sin tocar el resto del código).
 */
export const PHOTO_PROVIDER = Symbol('PHOTO_PROVIDER');

/** Palabra clave del sujeto entrenado; se inserta en los prompts de generación. */
export const TRIGGER_WORD = 'TOK';

export type TrainingStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';

export interface TrainingHandle {
  trainingId: string;
}

export interface TrainingResult {
  status: TrainingStatus;
  /** Versión del modelo entrenado (owner/name:hash), presente cuando status = succeeded. */
  modelVersion?: string;
}

export interface PhotoProvider {
  /** Lanza el entrenamiento LoRA a partir de un .zip de fotos (URL accesible). */
  train(zipUrl: string): Promise<TrainingHandle>;
  /** Consulta el estado del entrenamiento (para polling). */
  getTrainingStatus(trainingId: string): Promise<TrainingResult>;
  /** Genera imágenes con el modelo entrenado y un prompt. Devuelve URLs. */
  generate(modelVersion: string, prompt: string): Promise<string[]>;
}
