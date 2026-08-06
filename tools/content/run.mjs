import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CONTENT_DIR = path.join(ROOT, 'content');

const CONTENT_DIRS = ['raw', 'normalized', 'curated', 'generated', 'manifests', 'licenses', 'reports'];

const STAGES = ['download', 'import', 'normalize', 'generate', 'validate', 'report', 'publish'];

async function ensureContentDirs() {
  for (const dir of CONTENT_DIRS) {
    await mkdir(path.join(CONTENT_DIR, dir), { recursive: true });
  }
}

async function runStage(stage) {
  const reportPath = path.join(CONTENT_DIR, 'reports', `${stage}.json`);
  const report = {
    stage,
    status: 'stub',
    ranAt: new Date().toISOString(),
    message: `Étape "${stage}" du pipeline de contenu (implémentation phase 1).`,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[content] ${stage}: ok (rapport: content/reports/${stage}.json)`);
}

async function main() {
  const requested = process.argv[2];
  if (!requested) {
    console.error('Usage: node tools/content/run.mjs <stage|all>');
    console.error(`Étapes disponibles: ${STAGES.join(', ')}`);
    process.exit(1);
  }
  await ensureContentDirs();
  const stages = requested === 'all' ? STAGES : [requested];
  for (const stage of stages) {
    if (!STAGES.includes(stage)) {
      console.error(`Étape inconnue: ${stage}`);
      process.exit(1);
    }
    await runStage(stage);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
