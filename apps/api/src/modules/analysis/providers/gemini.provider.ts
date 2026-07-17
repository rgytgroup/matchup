import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, type Part } from '@google/generative-ai';
import type { AnalysisProvider } from '../analysis-provider.interface';

/**
 * Proveedor de análisis con Google Gemini (visión + texto, salida JSON).
 * Descarga las fotos desde sus URLs (firmadas de Supabase) y las envía como
 * partes de imagen inline junto al prompt, forzando respuesta JSON (SPEC §5).
 */
@Injectable()
export class GeminiAnalysisProvider implements AnalysisProvider {
  constructor(private readonly config: ConfigService) {}

  private getModel() {
    const key = this.config.get<string>('GEMINI_API_KEY');
    if (!key) throw new Error('GEMINI_API_KEY no configurada');
    const model = this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.5-flash';
    return new GoogleGenerativeAI(key).getGenerativeModel({
      model,
      generationConfig: { responseMimeType: 'application/json' },
    });
  }

  async generateReportJson(prompt: string, photoUrls: string[]): Promise<string> {
    return this.runJson(prompt, photoUrls);
  }

  async moderate(prompt: string, photoUrls: string[]): Promise<string> {
    return this.runJson(prompt, photoUrls);
  }

  private async runJson(prompt: string, photoUrls: string[]): Promise<string> {
    const parts: Part[] = [{ text: prompt }, ...(await this.toImageParts(photoUrls))];
    const result = await this.getModel().generateContent(parts);
    return result.response.text();
  }

  private async toImageParts(photoUrls: string[]): Promise<Part[]> {
    const parts: Part[] = [];
    for (const url of photoUrls) {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`No se pudo descargar la imagen (HTTP ${res.status}): ${url}`);
      }
      const mimeType = res.headers.get('content-type') ?? 'image/jpeg';
      const data = Buffer.from(await res.arrayBuffer()).toString('base64');
      parts.push({ inlineData: { data, mimeType } });
    }
    return parts;
  }
}
