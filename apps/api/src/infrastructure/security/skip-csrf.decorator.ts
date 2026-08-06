import { SetMetadata } from '@nestjs/common';

export const SKIP_CSRF_METADATA = 'kanjipath:skip-csrf';

export const SkipCsrf = () => SetMetadata(SKIP_CSRF_METADATA, true);
