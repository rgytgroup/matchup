import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  GenerationResult,
  PhotoProvider,
  TrainingResult,
} from '../photo-provider.interface';

/**
 * Proveedor de fotos con Replicate (entrenamiento LoRA + generación).
 * TODO(photos): integrar el SDK `replicate` (crear training, poll de estado,
 * generación por escenarios de /prompts/photo-scenarios.md). Stub por ahora.
 */
@Injectable()
export class ReplicatePhotoProvider implements PhotoProvider {
  constructor(private readonly config: ConfigService) {}

  private requireToken(): string {
    const token = this.config.get<string>('REPLICATE_API_TOKEN');
    if (!token) throw new Error('REPLICATE_API_TOKEN no configurada');
    return token;
  }

  async train(_photoUrls: string[]): Promise<TrainingResult> {
    this.requireToken();
    throw new Error('ReplicatePhotoProvider.train: pendiente de integrar (SPEC §6.1)');
  }

  async generate(_trainingId: string, _prompts: string[]): Promise<GenerationResult> {
    this.requireToken();
    throw new Error('ReplicatePhotoProvider.generate: pendiente de integrar (SPEC §6.2)');
  }
}
