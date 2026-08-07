import path from 'node:path';
import { writeJson } from '../lib/fs-utils.mjs';
import { runImport } from '../lib/importers.mjs';
import { REPORTS_DIR } from '../lib/paths.mjs';

export async function stageImport({ force = false } = {}) {
  const startedAt = Date.now();
  await runImport({ force });
  await writeJson(path.join(REPORTS_DIR, 'import.json'), {
    stage: 'import',
    status: 'ok',
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
  });
}
