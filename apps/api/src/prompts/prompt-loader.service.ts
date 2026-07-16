import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Carga los prompts de IA desde /prompts/*.md (SPEC §5, §6; CLAUDE.md).
 * NUNCA se hardcodean prompts en el código: el código los lee de aquí.
 */
@Injectable()
export class PromptLoaderService {
  private readonly promptsDir = this.resolvePromptsDir();
  private readonly cache = new Map<string, string>();

  private resolvePromptsDir(): string {
    // Sube desde este archivo hasta la raíz del repo buscando /prompts.
    let dir = __dirname;
    for (let i = 0; i < 8; i += 1) {
      const candidate = join(dir, 'prompts');
      if (existsSync(join(candidate, 'analysis-system.md'))) return candidate;
      dir = dirname(dir);
    }
    const fallback = resolve(process.cwd(), 'prompts');
    return fallback;
  }

  load(name: string): string {
    const key = name.endsWith('.md') ? name : `${name}.md`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const path = join(this.promptsDir, key);
    if (!existsSync(path)) {
      throw new Error(`Prompt no encontrado: ${path}. ¿Existe en /prompts?`);
    }
    const content = readFileSync(path, 'utf8');
    this.cache.set(key, content);
    return content;
  }

  /** Sustituye placeholders {{clave}} por valores. Deja intactos los no provistos. */
  render(name: string, vars: Record<string, string | number>): string {
    const tpl = this.load(name);
    return tpl.replace(/\{\{(\w+)\}\}/g, (_match, k: string) =>
      k in vars ? String(vars[k]) : `{{${k}}}`,
    );
  }
}
