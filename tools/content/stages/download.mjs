import path from 'node:path';
import { downloadFile } from '../lib/download.mjs';
import { sha256File } from '../lib/hash.mjs';
import { writeJson } from '../lib/fs-utils.mjs';
import { RAW_DIR, REPORTS_DIR } from '../lib/paths.mjs';
import { SOURCES, SOURCE_ORDER } from '../sources.mjs';

export async function stageDownload({ force = false } = {}) {
  const files = [];
  for (const sourceId of SOURCE_ORDER) {
    const source = SOURCES[sourceId];
    for (const fileDef of source.files) {
      const destPath = path.join(RAW_DIR, fileDef.file);
      console.log(`[download] ${source.name}: ${fileDef.file}`);
      const result = await downloadFile(fileDef.url, destPath, { force });
      files.push({
        sourceId: source.id,
        file: fileDef.file,
        url: fileDef.url,
        version: fileDef.version ?? null,
        sha256: result.sha256,
        bytes: result.bytes,
        downloaded: result.downloaded,
      });
    }
  }
  const report = {
    stage: 'download',
    status: 'ok',
    ranAt: new Date().toISOString(),
    files,
  };
  await writeJson(path.join(REPORTS_DIR, 'download.json'), report);
  return report;
}

export async function checksumOf(rawFile) {
  return sha256File(path.join(RAW_DIR, rawFile));
}
