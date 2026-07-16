// Marca la carpeta dist/esm como módulos ES para consumidores Node (SPEC: build dual).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, '..', 'dist', 'esm', 'package.json');
writeFileSync(target, JSON.stringify({ type: 'module' }, null, 2));
