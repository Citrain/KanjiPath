import type {
  JapaneseSpeechSpeed,
  ShadowingComparisonResponse,
  ShadowingResultDto,
  ShadowingResultsResponse,
  ShadowingSaveResultInput,
  ShadowingTargetDto,
  ShadowingTargetsQuery,
  ShadowingTargetsResponse,
  ShadowingTranscribeInput,
  ShadowingTranscribeResponse,
  ShadowingTtsAudioResponse,
} from '@kanjipath/contracts';
import { SHADOWING_MAX_AUDIO_BYTES, SHADOWING_MAX_RESULTS } from '@kanjipath/contracts';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  JAPANESE_TTS_PROVIDER,
  type JapaneseTtsProvider,
  type SpeechToTextProvider,
  STT_PROVIDER,
} from '../conversation/conversation.providers';
import { compareShadowingTranscript, shadowingReadingOf } from './shadowing-compare';

type PublishedSentence = Prisma.SentenceGetPayload<{
  include: { tokens: true; audioResources: true };
}>;

@Injectable()
export class ShadowingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STT_PROVIDER) private readonly stt: SpeechToTextProvider,
    @Inject(JAPANESE_TTS_PROVIDER) private readonly japaneseTts: JapaneseTtsProvider,
  ) {}

  async targets(query: ShadowingTargetsQuery): Promise<ShadowingTargetsResponse> {
    const level = query.level ?? 'N5';
    const source = query.source ?? 'audio';
    const take = query.limit ?? 12;
    const where: Prisma.SentenceWhereInput =
      source === 'audio'
        ? {
            editorialStatus: 'published',
            difficulty: level as never,
            audioResources: { some: { editorialStatus: 'published' } },
          }
        : {
            editorialStatus: 'published',
            difficulty: level as never,
          };
    const sentences = await this.prisma.sentence.findMany({
      where,
      orderBy: { id: 'asc' },
      take,
      include: {
        tokens: { orderBy: { startOffset: 'asc' } },
        audioResources: { where: { editorialStatus: 'published' }, take: 1 },
      },
    });
    const targets: ShadowingTargetDto[] = sentences.map((sentence) => {
      const audioResource = sentence.audioResources[0];
      return {
        id: sentence.id,
        japanese: sentence.japanese,
        reading: shadowingReadingOf(sentence.tokens),
        translationFr: sentence.translationFr,
        level: sentence.difficulty as ShadowingTargetDto['level'],
        author: sentence.author,
        sentenceLicense: sentence.license,
        audio:
          source === 'audio' && audioResource
            ? {
                url: `/audio/${audioResource.id}`,
                attribution: audioResource.attributionText,
                license: audioResource.license,
              }
            : null,
        tokens: sentence.tokens.map((token) => ({
          surface: token.surface,
          reading: token.reading,
          romaji: token.romaji,
        })),
      };
    });
    return { level, source, targets };
  }

  async ttsAudio(
    sentenceId: string,
    speed: JapaneseSpeechSpeed | undefined,
  ): Promise<ShadowingTtsAudioResponse> {
    const sentence = await this.publishedSentence(sentenceId);
    const speedScale = speed === 'slow' ? 0.82 : speed === 'natural' ? 1.12 : 1;
    try {
      const speech = await this.japaneseTts.synthesize(sentence.japanese, speedScale, 0);
      if (speech.bytes.length === 0) throw new Error('Audio vide');
      return { mimeType: speech.mimeType, base64: speech.bytes.toString('base64') };
    } catch {
      throw new ServiceUnavailableException({
        code: 'TTS_UNAVAILABLE',
        message:
          'La voix locale (TTS) est indisponible. Choisissez une phrase avec audio publié pour continuer l’écoute.',
      });
    }
  }

  async transcribe(input: ShadowingTranscribeInput): Promise<ShadowingTranscribeResponse> {
    const health = await this.stt.health();
    if (!health.available) {
      throw this.sttUnavailable(health.detail);
    }
    const audio = Buffer.from(input.audioBase64, 'base64');
    if (audio.byteLength === 0) {
      throw new BadRequestException({ code: 'AUDIO_EMPTY', message: 'Audio vide' });
    }
    if (audio.byteLength > SHADOWING_MAX_AUDIO_BYTES) {
      throw new PayloadTooLargeException({
        code: 'AUDIO_TOO_LARGE',
        message: 'Enregistrement trop long : 20 secondes maximum.',
      });
    }
    try {
      const transcript = await this.stt.transcribe(audio);
      return { transcript };
    } catch {
      throw this.sttUnavailable('La transcription a échoué');
    }
  }

  async compare(sentenceId: string, transcript: string): Promise<ShadowingComparisonResponse> {
    const sentence = await this.publishedSentence(sentenceId);
    const comparison = compareShadowingTranscript(sentence.tokens, transcript);
    return {
      sentenceId,
      transcript,
      targetReading: comparison.targetReading,
      matched: comparison.matched,
      segments: comparison.segments.map((segment) => ({
        surface: segment.surface,
        reading: segment.reading,
        romaji: segment.romaji,
        status: segment.status,
      })),
    };
  }

  async saveResult(userId: string, input: ShadowingSaveResultInput): Promise<ShadowingResultDto> {
    const sentence = await this.publishedSentence(input.sentenceId);
    const comparison = compareShadowingTranscript(sentence.tokens, input.transcript);
    const existingCount = await this.prisma.shadowingResult.count({ where: { userId } });
    if (existingCount >= SHADOWING_MAX_RESULTS) {
      throw new BadRequestException({
        code: 'SHADOWING_RESULTS_FULL',
        message: `Limite de ${SHADOWING_MAX_RESULTS} résultats conservés atteinte. Supprimez d’anciens résultats.`,
      });
    }
    const audioResource =
      input.source === 'audio'
        ? sentence.audioResources.find((resource) => resource.editorialStatus === 'published')
        : undefined;
    const created = await this.prisma.shadowingResult.create({
      data: {
        userId,
        sentenceId: sentence.id,
        source: input.source,
        japanese: sentence.japanese,
        reading: shadowingReadingOf(sentence.tokens),
        translationFr: sentence.translationFr,
        transcript: input.transcript,
        matched: comparison.matched,
        matchedSegments: comparison.segments.filter((segment) => segment.status === 'matched')
          .length,
        totalSegments: comparison.segments.length,
        attribution: audioResource?.attributionText ?? sentence.author,
        license: audioResource?.license ?? sentence.license,
      },
    });
    return this.toResultDto(created);
  }

  async results(userId: string): Promise<ShadowingResultsResponse> {
    const rows = await this.prisma.shadowingResult.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: SHADOWING_MAX_RESULTS,
    });
    return { results: rows.map((row) => this.toResultDto(row)) };
  }

  async deleteResult(userId: string, id: string): Promise<void> {
    const row = await this.prisma.shadowingResult.findFirst({ where: { id, userId } });
    if (!row) {
      throw new NotFoundException('Résultat de shadowing introuvable');
    }
    await this.prisma.shadowingResult.delete({ where: { id: row.id } });
  }

  async clearResults(userId: string): Promise<void> {
    await this.prisma.shadowingResult.deleteMany({ where: { userId } });
  }

  private toResultDto(row: {
    id: string;
    sentenceId: string | null;
    source: 'audio' | 'tts';
    japanese: string;
    reading: string;
    translationFr: string | null;
    transcript: string;
    matched: boolean;
    matchedSegments: number;
    totalSegments: number;
    attribution: string | null;
    license: string | null;
    createdAt: Date;
  }): ShadowingResultDto {
    return {
      id: row.id,
      sentenceId: row.sentenceId,
      source: row.source,
      japanese: row.japanese,
      reading: row.reading,
      translationFr: row.translationFr,
      transcript: row.transcript,
      matched: row.matched,
      matchedSegments: row.matchedSegments,
      totalSegments: row.totalSegments,
      attribution: row.attribution,
      license: row.license,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async publishedSentence(sentenceId: string): Promise<PublishedSentence> {
    const sentence = await this.prisma.sentence.findFirst({
      where: { id: sentenceId, editorialStatus: 'published' },
      include: {
        tokens: { orderBy: { startOffset: 'asc' } },
        audioResources: { where: { editorialStatus: 'published' } },
      },
    });
    if (!sentence) {
      throw new NotFoundException('Phrase cible introuvable');
    }
    return sentence;
  }

  private sttUnavailable(detail: string | null): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'STT_UNAVAILABLE',
      message: `Le service local de transcription (STT) est indisponible${detail ? ` (${detail})` : ''}. L’écoute reste possible, aucune comparaison n’est produite.`,
    });
  }
}
