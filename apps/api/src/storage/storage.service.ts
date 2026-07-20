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

  /** Sube archivos bajo un prefijo y devuelve las rutas guardadas. */
  async uploadFiles(prefix: string, files: UploadableFile[]): Promise<string[]> {
    const paths: string[] = [];
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const ext = (file.originalname.split('.').pop() ?? 'jpg').toLowerCase();
      paths.push(await this.uploadBytes(`${prefix}/${i}.${ext}`, file.buffer, file.mimetype));
    }
    return paths;
  }

  /** Sube las fotos de una orden y devuelve las rutas (no URLs) guardadas. */
  uploadPhotos(orderId: string, files: UploadableFile[]): Promise<string[]> {
    return this.uploadFiles(`orders/${orderId}`, files);
  }

  /** Sube los screenshots del intake (carpeta aparte para no chocar con las fotos). */
  uploadScreenshots(orderId: string, files: UploadableFile[]): Promise<string[]> {
    return this.uploadFiles(`orders/${orderId}/screenshots`, files);
  }

  /** Sube el PDF del reporte y devuelve su ruta. */
  async uploadPdf(path: string, buffer: Buffer): Promise<string> {
    return this.uploadBytes(path, buffer, 'application/pdf');
  }

  /** Descarga desde una URL (p. ej. una foto temporal de Replicate) y la persiste en el bucket. */
  async uploadFromUrl(path: string, url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`No se pudo descargar ${url} (HTTP ${res.status})`);
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const buffer = Buffer.from(await res.arrayBuffer());
    return this.uploadBytes(path, buffer, contentType);
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

  /**
   * Borra TODAS las fotos de una orden (subidas + generadas + zip de entrenamiento).
   * NO toca el PDF del reporte (reports/…), que debe permanecer (SPEC §8).
   * Usado por el cron de borrado a 30 días.
   */
  async deleteOrderPhotos(orderId: string): Promise<void> {
    const client = this.getClient();
    for (const prefix of [
      `orders/${orderId}`,
      `orders/${orderId}/generated`,
      `orders/${orderId}/screenshots`,
    ]) {
      const { data } = await client.storage.from(this.bucket).list(prefix);
      // Solo archivos (las subcarpetas tienen id null en Supabase).
      const paths = (data ?? []).filter((f) => f.id).map((f) => `${prefix}/${f.name}`);
      if (paths.length > 0) await client.storage.from(this.bucket).remove(paths);
    }
    await client.storage.from(this.bucket).remove([`training/${orderId}.zip`]);
  }
}
