import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AnalysisProvider } from '../analysis-provider.interface';

/**
 * Proveedor de análisis con Google Gemini (visión + texto, salida JSON).
 * TODO(analysis): integrar `@google/generative-ai` con response_mime_type=application/json
 * y las fotos como partes de imagen (descargadas desde las URLs firmadas de Supabase).
 * Se mantiene como stub para que el scaffold compile y arranque sin la clave.
 */
@Injectable()
export class GeminiAnalysisProvider implements AnalysisProvider {
  constructor(private readonly config: ConfigService) {}

  private requireKey(): string {
    const key = this.config.get<string>('GEMINI_API_KEY');
    if (!key) throw new Error('GEMINI_API_KEY no configurada');
    return key;
  }

  async generateReportJson(_prompt: string, _photoUrls: string[]): Promise<string> {
    this.requireKey();
    throw new Error('GeminiAnalysisProvider.generateReportJson: pendiente de integrar (SPEC §5)');
  }

  async moderate(_prompt: string, _photoUrls: string[]): Promise<string> {
    this.requireKey();
    throw new Error('GeminiAnalysisProvider.moderate: pendiente de integrar (SPEC §8)');
  }
}
