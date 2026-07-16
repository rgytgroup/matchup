import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Replicate from 'replicate';
import type {
  GenerationResult,
  PhotoProvider,
  TrainingResult,
} from '../photo-provider.interface';

/**
 * Proveedor de fotos con Replicate (entrenamiento LoRA + generación, SPEC §6).
 * Los IDs de modelo son configurables por env para poder cambiar de trainer/base
 * sin tocar código. NOTA: el schema exacto de `input` depende del trainer elegido
 * (muchos LoRA trainers esperan `input_images` como URL de un .zip) — ajústalo al tuyo.
 */
@Injectable()
export class ReplicatePhotoProvider implements PhotoProvider {
  constructor(private readonly config: ConfigService) {}

  private getClient(): Replicate {
    const auth = this.config.get<string>('REPLICATE_API_TOKEN');
    if (!auth) throw new Error('REPLICATE_API_TOKEN no configurada');
    return new Replicate({ auth });
  }

  async train(photoUrls: string[]): Promise<TrainingResult> {
    const ref = this.config.get<string>('REPLICATE_TRAINING_MODEL');
    if (!ref) throw new Error('REPLICATE_TRAINING_MODEL no configurada');
    const { owner, name, version } = this.parseRef(ref);
    const destination = (this.config.get<string>('REPLICATE_BASE_MODEL') ||
      `${owner}/${name}-out`) as `${string}/${string}`;

    const training = await this.getClient().trainings.create(owner, name, version, {
      destination,
      input: { input_images: photoUrls },
    });
    return { trainingId: training.id };
  }

  async generate(trainingId: string, prompts: string[]): Promise<GenerationResult> {
    const baseModel = this.config.get<string>('REPLICATE_BASE_MODEL');
    if (!baseModel) throw new Error('REPLICATE_BASE_MODEL no configurada');

    const imageUrls: string[] = [];
    for (const prompt of prompts) {
      const output = await this.getClient().run(baseModel as `${string}/${string}`, {
        input: { prompt, lora: trainingId },
      });
      imageUrls.push(...this.extractUrls(output));
    }
    return { imageUrls };
  }

  private parseRef(ref: string): { owner: string; name: string; version: string } {
    const [path, version] = ref.split(':');
    const [owner, name] = (path ?? '').split('/');
    if (!owner || !name || !version) {
      throw new Error(`REPLICATE_TRAINING_MODEL debe ser "owner/model:version" (recibí "${ref}")`);
    }
    return { owner, name, version };
  }

  private extractUrls(output: unknown): string[] {
    if (Array.isArray(output)) return output.map((o) => String(o));
    if (typeof output === 'string') return [output];
    return [];
  }
}
