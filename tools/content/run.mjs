import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { CONTENT_DIR } from './lib/paths.mjs';

const CONTENT_DIRS = ['raw', 'normalized', 'curated', 'generated', 'manifests', 'licenses', 'reports'];

const STAGES = ['download', 'import', 'normalize', 'generate', 'validate', 'report', 'publish', 'load'];

async function ensureContentDirs() {
  for (const dir of CONTENT_DIRS) {
    await mkdir(path.join(CONTENT_DIR, dir), { recursive: true });
  }
}

async function loadStage(stage) {
  if (stage === 'load') {
    const module = await import('./load.mjs');
    return module.stageLoad;
  }
  const module = await import(`./stages/${stage}.mjs`);
  const fnName = `stage${stage.charAt(0).toUpperCase()}${stage.slice(1)}`;
  const fn = module[fnName];
  if (typeof fn !== 'function') {
    throw new Error(`Étape "${stage}" introuvable (${fnName})`);
  }
  return fn;
}

async function main() {
  const args = process.argv.slice(2);
  const requested = args.find((arg) => !arg.startsWith('--'));
  const force = args.includes('--force');
  if (!requested) {
    console.error('Usage: node tools/content/run.mjs <stage|all> [--force]');
    console.error(`Étapes disponibles: ${STAGES.join(', ')} ("all" = pipeline sans load)`);
    process.exit(1);
  }
  await ensureContentDirs();
  const stages = requested === 'all' ? STAGES.filter((stage) => stage !== 'load') : [requested];
  for (const stage of stages) {
    if (!STAGES.includes(stage)) {
      console.error(`Étape inconnue: ${stage}`);
      process.exit(1);
    }
    const fn = await loadStage(stage);
    const startedAt = Date.now();
    await fn({ force });
    console.log(`[content] ${stage}: ok (${((Date.now() - startedAt) / 1000).toFixed(1)}s)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
