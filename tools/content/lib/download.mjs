import { createWriteStream } from 'node:fs';
import { mkdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { sha256File } from './hash.mjs';

const MAX_ATTEMPTS = 3;

async function fetchToFile(url, destPath) {
  const tmpPath = `${destPath}.part`;
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20 * 60 * 1000),
    headers: { 'user-agent': 'kanjipath-content-pipeline' },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} pour ${url}`);
  }
  await pipeline(response.body, createWriteStream(tmpPath));
  await rename(tmpPath, destPath);
}

export async function downloadFile(url, destPath, { force = false } = {}) {
  await mkdir(path.dirname(destPath), { recursive: true });
  if (!force) {
    const existing = await stat(destPath).catch(() => null);
    if (existing && existing.size > 0) {
      return { downloaded: false, sha256: await sha256File(destPath), bytes: existing.size };
    }
  }
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await fetchToFile(url, destPath);
      const bytes = (await stat(destPath)).size;
      if (bytes === 0) {
        throw new Error('fichier vide');
      }
      return { downloaded: true, sha256: await sha256File(destPath), bytes };
    } catch (error) {
      lastError = error;
      console.warn(`[download] tentative ${attempt}/${MAX_ATTEMPTS} échouée pour ${url}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
  throw new Error(`Téléchargement impossible: ${url} (${lastError?.message ?? 'erreur inconnue'})`);
}
