import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

export interface UploadableFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

/**
 * Almacenamiento en Supabase Storage (bucket privado, SPEC §2).
 * Las fotos se guardan por orden y se acceden solo mediante URLs firmadas.
 */
@Injectable()
export class StorageService {
  private client: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): SupabaseClient {
    if (this.client) return this.client;
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_KEY');
    if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY no configuradas');
    // No usamos Realtime, pero supabase-js lo inicializa y su factory exige un
    // WebSocket global (Node 20 no lo trae nativo). Le damos el de "ws".
    const g = globalThis as { WebSocket?: unknown };
    if (!g.WebSocket) g.WebSocket = WebSocket;

    this.client = createClient(url, key, { auth: { persistSession: false } });
    return this.client;
  }

  private get bucket(): string {
    return this.config.get<string>('SUPABASE_BUCKET') ?? 'submissions';
  }

  /** Sube las fotos de una orden y devuelve las rutas (no URLs) guardadas. */
  async uploadPhotos(orderId: string, files: UploadableFile[]): Promise<string[]> {
    const client = this.getClient();
    const paths: string[] = [];
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const ext = (file.originalname.split('.').pop() ?? 'jpg').toLowerCase();
      const path = `orders/${orderId}/${i}.${ext}`;
      const { error } = await client.storage.from(this.bucket).upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });
      if (error) throw new Error(`Fallo subiendo ${path}: ${error.message}`);
      paths.push(path);
    }
    return paths;
  }

  /** Sube el PDF del reporte y devuelve su ruta. */
  async uploadPdf(path: string, buffer: Buffer): Promise<string> {
    return this.uploadBytes(path, buffer, 'application/pdf');
  }

  /** Sube un buffer arbitrario (p. ej. el .zip de entrenamiento) y devuelve su ruta. */
  async uploadBytes(path: string, buffer: Buffer, contentType: string): Promise<string> {
    const { error } = await this.getClient().storage.from(this.bucket).upload(path, buffer, {
      contentType,
      upsert: true,
    });
    if (error) throw new Error(`Fallo subiendo ${path}: ${error.message}`);
    return path;
  }

  /** Firma rutas privadas para lectura temporal (p. ej. para pasarlas a Gemini). */
  async signUrls(paths: string[], expiresInSeconds = 3600): Promise<string[]> {
    if (paths.length === 0) return [];
    const { data, error } = await this.getClient()
      .storage.from(this.bucket)
      .createSignedUrls(paths, expiresInSeconds);
    if (error) throw new Error(`Fallo firmando URLs: ${error.message}`);
    return (data ?? [])
      .map((d) => d.signedUrl)
      .filter((u): u is string => typeof u === 'string');
  }

  /** Borra todas las fotos bajo un prefijo (usado por el cron de borrado a 30 días, SPEC §8). */
  async deletePrefix(prefix: string): Promise<void> {
    const client = this.getClient();
    const { data, error } = await client.storage.from(this.bucket).list(prefix);
    if (error) throw new Error(`Fallo listando ${prefix}: ${error.message}`);
    const paths = (data ?? []).map((f) => `${prefix}/${f.name}`);
    if (paths.length > 0) await client.storage.from(this.bucket).remove(paths);
  }
}
