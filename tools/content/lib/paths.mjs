import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
export const CONTENT_DIR = path.join(ROOT, 'content');

export const RAW_DIR = path.join(CONTENT_DIR, 'raw');
export const NORMALIZED_DIR = path.join(CONTENT_DIR, 'normalized');
export const IMPORTED_DIR = path.join(NORMALIZED_DIR, 'imported');
export const CURATED_DIR = path.join(CONTENT_DIR, 'curated');
export const GENERATED_DIR = path.join(CONTENT_DIR, 'generated');
export const MANIFESTS_DIR = path.join(CONTENT_DIR, 'manifests');
export const LICENSES_DIR = path.join(CONTENT_DIR, 'licenses');
export const REPORTS_DIR = path.join(CONTENT_DIR, 'reports');
export const KANJIVG_DIR = path.join(GENERATED_DIR, 'kanjivg');

export const PACK_DIR = path.join(GENERATED_DIR, 'pack');
