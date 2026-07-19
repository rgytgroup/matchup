import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Replicate from 'replicate';
import {
  TRIGGER_WORD,
  type PhotoProvider,
  type TrainingHandle,
  type TrainingResult,
  type TrainingStatus,
} from '../photo-provider.interface';

/**
 * Proveedor de fotos con Replicate (entrenamiento LoRA + generación, SPEC §6).
 * Modelos configurables por env. El entrenador por defecto asumido es del estilo
 * "ostris/flux-dev-lora-trainer": recibe `input_images` (URL de un .zip),
 * `trigger_word` y `steps`, y publica el LoRA en el modelo destino; su output
 * incluye `version` (owner/name:hash) que luego se corre para generar.
 */
@Injectable()
export class ReplicatePhotoProvider implements PhotoProvider {
  constructor(private readonly config: ConfigService) {}

  private getClient(): Replicate {
    const auth = this.config.get<string>('REPLICATE_API_TOKEN');
    if (!auth) throw new Error('REPLICATE_API_TOKEN no configurada');
    return new Replicate({ auth });
  }

  async train(zipUrl: string): Promise<TrainingHandle> {
    const ref = this.config.get<string>('REPLICATE_TRAINING_MODEL');
    const destination = this.config.get<string>('REPLICATE_DESTINATION_MODEL');
    if (!ref) throw new Error('REPLICATE_TRAINING_MODEL no configurada');
    if (!destination) throw new Error('REPLICATE_DESTINATION_MODEL no configurada');

    const { owner, name, version } = this.parseRef(ref);
    const steps = this.config.get<number>('REPLICATE_TRAINING_STEPS') ?? 1000;

    const training = await this.getClient().trainings.create(owner, name, version, {
      destination: destination as `${string}/${string}`,
      input: {
        input_images: zipUrl,
        trigger_word: TRIGGER_WORD,
        steps,
      },
    });
    return { trainingId: training.id };
  }

  async getTrainingStatus(trainingId: string): Promise<TrainingResult> {
    const t = await this.getClient().trainings.get(trainingId);
    const status = t.status as TrainingStatus;
    const output = t.output as { version?: string } | null | undefined;
    return {
      status,
      modelVersion: status === 'succeeded' ? output?.version : undefined,
    };
  }

  async generate(modelVersion: string, prompt: string): Promise<string[]> {
    const output = await this.withRetryOn429(() =>
      this.getClient().run(modelVersion as `${string}/${string}:${string}`, {
        input: { prompt, num_outputs: 1, output_format: 'jpg', aspect_ratio: '1:1' },
      }),
    );
    return this.extractUrls(output);
  }

  /** Reintenta ante 429 (rate limit de Replicate, típico con poco crédito). */
  private async withRetryOn429<T>(fn: () => Promise<T>, retries = 6): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await fn();
      } catch (err) {
        const msg = (err as Error).message ?? '';
        const throttled = msg.includes('429') || /throttl/i.test(msg);
        if (!throttled || attempt >= retries) throw err;
        await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
      }
    }
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
