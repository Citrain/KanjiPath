import { seededRng, pickSeeded } from './hash.mjs';
import { kanaToRomaji } from './romaji.mjs';

export function normalizeAnswer(text) {
  return String(text).normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function uniqueByNorm(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const norm = normalizeAnswer(value);
    if (seen.has(norm)) {
      continue;
    }
    seen.add(norm);
    out.push(value);
  }
  return out;
}

export function pickDistractors(rng, pool, answer, count) {
  const answerNorm = normalizeAnswer(answer);
  const candidates = uniqueByNorm(pool.filter((item) => normalizeAnswer(item) !== answerNorm));
  return pickSeeded(rng, candidates, count);
}

export function makeExercise({ template, skill, level, targetKanjiId, prompt, acceptedAnswers, distractors, explanation, difficulty, vocabularyId, sentenceId, variantKey, sourceId }) {
  const id = `x-${template}-${targetKanjiId.replace('k-', '')}-${variantKey}`;
  return {
    id,
    template,
    skill,
    level,
    targetKanjiId,
    vocabularyId,
    sentenceId,
    prompt,
    acceptedAnswers: uniqueByNorm(acceptedAnswers),
    distractors: distractors ?? [],
    explanation,
    difficulty,
    sourceId,
    editorialStatus: 'reviewed',
  };
}

export function buildKanjiContext(pack) {
  const kanjiByLiteral = new Map(pack.kanji.map((k) => [k.literal, k]));
  const kanjiById = new Map(pack.kanji.map((k) => [k.id, k]));
  const vocabByKanji = new Map(pack.kanji.map((k) => [k.id, []]));
  for (const vocab of pack.vocabulary) {
    for (const link of vocab.kanji) {
      if (vocabByKanji.has(link.kanjiId)) {
        vocabByKanji.get(link.kanjiId).push({ vocab, link });
      }
    }
  }
  const sentencesByKanji = new Map(pack.kanji.map((k) => [k.id, []]));
  for (const sentence of pack.sentences) {
    for (const kanjiId of sentence.targetKanjiIds) {
      if (sentencesByKanji.has(kanjiId)) {
        sentencesByKanji.get(kanjiId).push(sentence);
      }
    }
  }
  return { kanjiByLiteral, kanjiById, vocabByKanji, sentencesByKanji };
}

export function primaryMeaning(kanji) {
  return kanji.meanings.find((m) => m.isPrimary)?.meaning ?? kanji.meanings[0].meaning;
}

export function sentencePromptTokens(sentence, { hideSurfaces = [], hideSpan = null, blankLiteral = null } = {}) {  return (sentence.tokens ?? []).map((token) => {
    const surface = blankLiteral ? token.surface.split(blankLiteral).join('＿') : token.surface;
    const overlapsSpan = hideSpan !== null && token.startOffset < hideSpan.end && token.endOffset > hideSpan.start;
    const hidden = blankLiteral
      ? token.surface.includes(blankLiteral)
      : overlapsSpan || hideSurfaces.some((hide) => token.surface.includes(hide));
    return {
      surface,
      reading: hidden ? null : token.reading ?? null,
      romaji: hidden ? null : token.romaji ?? null,
    };
  });
}

export function hideSpanFor(japanese, word) {
  const index = japanese.indexOf(word);
  if (index === -1) {
    return null;
  }
  return { start: index, end: index + [...word].length };
}

const UNVOICED_MAP = {
  が: 'か', ぎ: 'き', ぐ: 'く', げ: 'け', ご: 'こ',
  ざ: 'さ', じ: 'し', ず: 'す', ぜ: 'せ', ぞ: 'そ',
  だ: 'た', ぢ: 'ち', づ: 'つ', で: 'て', ど: 'と',
  ば: 'は', び: 'ひ', ぶ: 'ふ', べ: 'へ', ぼ: 'ほ',
  ぱ: 'は', ぴ: 'ひ', ぷ: 'ふ', ぺ: 'へ', ぽ: 'ほ',
};

export function regularizedReadingVariants(reading) {
  const variants = new Set();
  const chars = [...reading];
  const devoiced = chars
    .map((ch, i) => (i > 0 && UNVOICED_MAP[ch] ? UNVOICED_MAP[ch] : ch))
    .join('');
  if (devoiced !== reading) {
    variants.add(devoiced);
  }
  const noSokuon = reading.replace(/っ(?=[^ぁぃぅぇぉゃゅょ])/g, '');
  if (noSokuon !== reading && noSokuon.length > 0) {
    variants.add(noSokuon);
  }
  return [...variants];
}

export function isAdvancedReadingWord(vocab) {
  if ((vocab.kanji?.length ?? 0) < 2) {
    return false;
  }
  const chars = [...vocab.reading];
  if (chars.length < 3) {
    return false;
  }
  const hasRendaku = chars.some((ch, i) => i > 0 && UNVOICED_MAP[ch] !== undefined);
  const hasSokuon = vocab.reading.includes('っ');
  return hasRendaku || hasSokuon;
}

export function generateMeaningExercises(pack, ctx, kanji) {
  const exercises = [];
  const meaning = primaryMeaning(kanji);
  const otherKanji = pack.kanji.filter((k) => k.id !== kanji.id);

  for (let variant = 0; variant < 5; variant += 1) {
    const rng = seededRng(`kanji_to_meaning_qcm:${kanji.id}:${variant}:${pack.version}`);
    const pool = uniqueByNorm(otherKanji.map(primaryMeaning)).slice();
    const distractors = pickSeeded(rng, pool.filter((m) => normalizeAnswer(m) !== normalizeAnswer(meaning)), 3);
    exercises.push(
      makeExercise({
        template: 'kanji_to_meaning_qcm',
        skill: 'meaning',
        level: kanji.level,
        targetKanjiId: kanji.id,
        prompt: { kanji: kanji.literal, instruction: 'Quel est le sens principal de ce kanji ?' },
        acceptedAnswers: [meaning],
        distractors,
        explanation: `${kanji.literal} signifie « ${meaning} ».`,
        difficulty: 1,
        variantKey: String(variant),
        sourceId: 'kanjipath_editorial',
      }),
    );
  }

  for (let variant = 0; variant < 5; variant += 1) {
    const rng = seededRng(`meaning_to_kanji_qcm:${kanji.id}:${variant}:${pack.version}`);
    const distractors = pickSeeded(rng, otherKanji.map((k) => k.literal), 3);
    exercises.push(
      makeExercise({
        template: 'meaning_to_kanji_qcm',
        skill: 'meaning',
        level: kanji.level,
        targetKanjiId: kanji.id,
        prompt: { meaning, instruction: 'Quel kanji correspond à ce sens ?' },
        acceptedAnswers: [kanji.literal],
        distractors,
        explanation: `« ${meaning} » s'écrit ${kanji.literal}.`,
        difficulty: 1,
        variantKey: String(variant),
        sourceId: 'kanjipath_editorial',
      }),
    );
  }
  return exercises;
}

export function generateReadingExercises(pack, ctx, kanji) {
  const exercises = [];
  const words = ctx.vocabByKanji.get(kanji.id) ?? [];
  const withReading = words.filter(({ link }) => link.readingInWord);
  const onReadings = kanji.readings.filter((r) => r.type === 'onyomi');
  const kunReadings = kanji.readings.filter((r) => r.type === 'kunyomi');

  for (let variant = 0; variant < 3; variant += 1) {
    const rng = seededRng(`kanji_to_reading_qcm:${kanji.id}:${variant}:${pack.version}`);
    if (withReading.length === 0) {
      break;
    }
    const { vocab, link } = withReading[variant % withReading.length];
    const answer = link.readingInWord;
    const sameKanjiReadings = kanji.readings
      .map((r) => r.reading.replace(/^-/, '').replace(/-$/, ''))
      .filter((r) => r.length > 0);
    const otherReadings = pack.vocabulary
      .flatMap((v) => v.kanji)
      .map((l) => l.readingInWord)
      .filter(Boolean);
    const pool = uniqueByNorm([...sameKanjiReadings, ...otherReadings]);
    const distractors = pickSeeded(rng, pool.filter((r) => normalizeAnswer(r) !== normalizeAnswer(answer)), 3);
    exercises.push(
      makeExercise({
        template: 'kanji_to_reading_qcm',
        skill: 'reading',
        level: kanji.level,
        targetKanjiId: kanji.id,
        vocabularyId: vocab.id,
        prompt: {
          word: vocab.writtenForm,
          wordReading: vocab.reading,
          position: link.position,
          instruction: `Comment lit-on le kanji ${kanji.literal} dans ce mot ?`,
        },
        acceptedAnswers: [answer],
        distractors,
        explanation: `Dans ${vocab.writtenForm}, ${kanji.literal} se lit ${answer}.`,
        difficulty: 2,
        variantKey: String(variant),
        sourceId: 'kanjipath_editorial',
      }),
    );
  }

  for (let variant = 0; variant < 5; variant += 1) {
    const rng = seededRng(`reading_input_kana:${kanji.id}:${variant}:${pack.version}`);
    if (words.length === 0) {
      break;
    }
    const { vocab } = words[variant % words.length];
    exercises.push(
      makeExercise({
        template: 'reading_input_kana',
        skill: 'reading',
        level: kanji.level,
        targetKanjiId: kanji.id,
        vocabularyId: vocab.id,
        prompt: { word: vocab.writtenForm, instruction: 'Écris la lecture de ce mot en kana.' },
        acceptedAnswers: [vocab.reading],
        distractors: [],
        explanation: `${vocab.writtenForm} se lit ${vocab.reading}.`,
        difficulty: 2,
        variantKey: String(variant),
        sourceId: 'kanjipath_editorial',
      }),
    );
  }

  const typeVariants = [];
  for (const r of onReadings) {
    typeVariants.push({ reading: r.reading, romaji: r.romaji ?? kanaToRomaji(r.reading), type: 'onyomi' });
  }
  for (const r of kunReadings) {
    typeVariants.push({ reading: r.reading, romaji: r.romaji ?? kanaToRomaji(r.reading), type: 'kunyomi' });
  }
  typeVariants.slice(0, 3).forEach((item, variant) => {
    const cleanReading = item.reading.replace(/^-/, '').replace(/-$/, '');
    exercises.push(
      makeExercise({
        template: 'reading_type_qcm',
        skill: 'reading',
        level: kanji.level,
        targetKanjiId: kanji.id,
        prompt: {
          kanji: kanji.literal,
          reading: cleanReading,
          readingRomaji: item.romaji ?? null,
          instruction: 'Cette lecture est-elle une lecture on ou kun ?',
        },
        acceptedAnswers: [item.type],
        distractors: [item.type === 'onyomi' ? 'kunyomi' : 'onyomi'],
        explanation:
          item.type === 'onyomi'
            ? `${cleanReading} est une lecture on'yomi (lecture sino-japonaise) de ${kanji.literal}.`
            : `${cleanReading} est une lecture kun'yomi (lecture japonaise) de ${kanji.literal}.`,
        difficulty: 2,
        variantKey: String(variant),
        sourceId: 'kanjipath_editorial',
      }),
    );
  });

  return exercises;
}

export function generateVocabularyExercises(pack, ctx, kanji) {
  const exercises = [];
  const words = ctx.vocabByKanji.get(kanji.id) ?? [];
  if (words.length === 0) {
    return exercises;
  }

  const readingsPool = uniqueByNorm(pack.vocabulary.map((v) => v.reading));
  const meaningsPool = uniqueByNorm(pack.vocabulary.map((v) => v.meaningFr));

  for (let variant = 0; variant < 5; variant += 1) {
    const rng = seededRng(`vocab_reading_qcm:${kanji.id}:${variant}:${pack.version}`);
    const { vocab } = words[variant % words.length];
    const distractors = pickSeeded(rng, readingsPool.filter((r) => normalizeAnswer(r) !== normalizeAnswer(vocab.reading)), 3);
    exercises.push(
      makeExercise({
        template: 'vocab_reading_qcm',
        skill: 'vocabulary',
        level: kanji.level,
        targetKanjiId: kanji.id,
        vocabularyId: vocab.id,
        prompt: { word: vocab.writtenForm, instruction: 'Quelle est la lecture de ce mot ?' },
        acceptedAnswers: [vocab.reading],
        distractors,
        explanation: `${vocab.writtenForm} se lit ${vocab.reading} (${vocab.meaningFr}).`,
        difficulty: 2,
        variantKey: String(variant),
        sourceId: 'jmdict',
      }),
    );
  }

  for (let variant = 0; variant < 5; variant += 1) {
    const rng = seededRng(`vocab_meaning_qcm:${kanji.id}:${variant}:${pack.version}`);
    const { vocab } = words[variant % words.length];
    const distractors = pickSeeded(rng, meaningsPool.filter((m) => normalizeAnswer(m) !== normalizeAnswer(vocab.meaningFr)), 3);
    exercises.push(
      makeExercise({
        template: 'vocab_meaning_qcm',
        skill: 'vocabulary',
        level: kanji.level,
        targetKanjiId: kanji.id,
        vocabularyId: vocab.id,
        prompt: { word: vocab.writtenForm, wordReading: vocab.reading, wordRomaji: vocab.romaji ?? null, instruction: 'Quel est le sens de ce mot ?' },
        acceptedAnswers: [vocab.meaningFr],
        distractors,
        explanation: `${vocab.writtenForm} (${vocab.reading}) signifie « ${vocab.meaningFr} ».`,
        difficulty: 2,
        variantKey: String(variant),
        sourceId: 'jmdict',
      }),
    );
  }

  return exercises;
}

export function generateAdvancedReadingExercises(pack, ctx, kanji) {
  const exercises = [];
  const words = (ctx.vocabByKanji.get(kanji.id) ?? []).filter(({ vocab }) => isAdvancedReadingWord(vocab));
  if (words.length === 0) {
    return exercises;
  }
  const readingsPool = uniqueByNorm(pack.vocabulary.map((v) => v.reading));

  for (let variant = 0; variant < 3; variant += 1) {
    const { vocab } = words[variant % words.length];
    const rng = seededRng(`vocab_reading_advanced_qcm:${kanji.id}:${variant}:${pack.version}`);
    const regularized = regularizedReadingVariants(vocab.reading);
    const pool = uniqueByNorm([...regularized, ...readingsPool]);
    const distractors = pickSeeded(
      rng,
      pool.filter((r) => normalizeAnswer(r) !== normalizeAnswer(vocab.reading)),
      3,
    );
    exercises.push(
      makeExercise({
        template: 'vocab_reading_advanced_qcm',
        skill: 'reading',
        level: kanji.level,
        targetKanjiId: kanji.id,
        vocabularyId: vocab.id,
        prompt: { word: vocab.writtenForm, instruction: 'Quelle est la lecture réelle de ce mot composé ?' },
        acceptedAnswers: [vocab.reading],
        distractors,
        explanation: `${vocab.writtenForm} se lit ${vocab.reading} — lecture irrégulière : elle ne se déduit pas directement des lectures isolées des kanji.`,
        difficulty: 3,
        variantKey: String(variant),
        sourceId: vocab.sourceId ?? 'jmdict',
      }),
    );
  }
  return exercises;
}

export function generateContextExercises(pack, ctx, kanji) {
  const exercises = [];
  const sentences = ctx.sentencesByKanji.get(kanji.id) ?? [];
  const words = ctx.vocabByKanji.get(kanji.id) ?? [];

  for (let variant = 0; variant < 4; variant += 1) {
    if (sentences.length === 0) {
      break;
    }
    const rng = seededRng(`sentence_cloze_kanji:${kanji.id}:${variant}:${pack.version}`);
    const sentence = sentences[variant % sentences.length];
    const tokens = sentencePromptTokens(sentence, { blankLiteral: kanji.literal });
    const confusions = kanji.confusions.filter((literal) => ctx.kanjiByLiteral.has(literal));
    const fallback = pack.kanji.filter((k) => k.id !== kanji.id).map((k) => k.literal);
    const distractorSource = confusions.length >= 3 ? confusions : [...confusions, ...fallback];
    const distractors = pickSeeded(rng, distractorSource.filter((l) => l !== kanji.literal), 3);
    exercises.push(
      makeExercise({
        template: 'sentence_cloze_kanji',
        skill: 'context',
        level: kanji.level,
        targetKanjiId: kanji.id,
        sentenceId: sentence.id,
        prompt: {
          sentence: tokens.map((token) => token.surface).join(''),
          tokens,
          translation: sentence.translationFr,
          instruction: 'Quel kanji complète cette phrase ?',
        },
        acceptedAnswers: [kanji.literal],
        distractors,
        explanation: `La phrase s'écrit avec ${kanji.literal} : ${sentence.japanese}`,
        difficulty: 3,
        variantKey: String(variant),
        sourceId: 'tatoeba',
      }),
    );
  }

  let readingVariant = 0;
  for (const { vocab } of words) {
    if (readingVariant >= 4) {
      break;
    }
    const sentence = sentences.find((s) => s.japanese.includes(vocab.writtenForm));
    if (!sentence) {
      continue;
    }
    const rng = seededRng(`sentence_cloze_reading:${kanji.id}:${readingVariant}:${pack.version}`);
    const readingsPool = uniqueByNorm(pack.vocabulary.map((v) => v.reading));
    const distractors = pickSeeded(rng, readingsPool.filter((r) => normalizeAnswer(r) !== normalizeAnswer(vocab.reading)), 3);
    exercises.push(
      makeExercise({
        template: 'sentence_cloze_reading',
        skill: 'context',
        level: kanji.level,
        targetKanjiId: kanji.id,
        sentenceId: sentence.id,
        vocabularyId: vocab.id,
        prompt: {
          sentence: sentence.japanese,
          tokens: sentencePromptTokens(sentence, { hideSpan: hideSpanFor(sentence.japanese, vocab.writtenForm) }),
          word: vocab.writtenForm,
          translation: sentence.translationFr,
          instruction: `Comment lit-on ${vocab.writtenForm} dans cette phrase ?`,
        },
        acceptedAnswers: [vocab.reading],
        distractors,
        explanation: `${vocab.writtenForm} se lit ${vocab.reading}.`,
        difficulty: 3,
        variantKey: String(readingVariant),
        sourceId: 'tatoeba',
      }),
    );
    readingVariant += 1;
  }

  const translationsPool = uniqueByNorm(pack.sentences.map((s) => s.translationFr));
  for (let variant = 0; variant < 4; variant += 1) {
    if (sentences.length === 0) {
      break;
    }
    const rng = seededRng(`sentence_translation_qcm:${kanji.id}:${variant}:${pack.version}`);
    const sentence = sentences[(variant + 1) % sentences.length];
    const distractors = pickSeeded(
      rng,
      translationsPool.filter((t) => normalizeAnswer(t) !== normalizeAnswer(sentence.translationFr)),
      3,
    );
    exercises.push(
      makeExercise({
        template: 'sentence_translation_qcm',
        skill: 'context',
        level: kanji.level,
        targetKanjiId: kanji.id,
        sentenceId: sentence.id,
        prompt: {
          sentence: sentence.japanese,
          tokens: sentencePromptTokens(sentence),
          instruction: 'Quelle est la traduction de cette phrase ?',
        },
        acceptedAnswers: [sentence.translationFr],
        distractors,
        explanation: `${sentence.japanese} se traduit par « ${sentence.translationFr} ».`,
        difficulty: 3,
        variantKey: String(variant),
        sourceId: 'tatoeba',
      }),
    );
  }

  return exercises;
}

export function generateStrokeExercises(pack, ctx, kanji) {
  const exercises = [];
  const radicalsPool = uniqueByNorm(pack.kanji.map((k) => k.radical?.literal).filter(Boolean));
  const componentsPool = uniqueByNorm(pack.kanji.flatMap((k) => k.components.map((c) => c.literal)));

  for (let variant = 0; variant < 2; variant += 1) {
    if (!kanji.radical) {
      break;
    }
    const rng = seededRng(`radical_recognition_qcm:${kanji.id}:${variant}:${pack.version}`);
    const distractors = pickSeeded(rng, radicalsPool.filter((l) => l !== kanji.radical.literal), 3);
    exercises.push(
      makeExercise({
        template: 'radical_recognition_qcm',
        skill: 'stroke',
        level: kanji.level,
        targetKanjiId: kanji.id,
        prompt: { kanji: kanji.literal, instruction: 'Quel est le radical principal de ce kanji ?' },
        acceptedAnswers: [kanji.radical.literal],
        distractors,
        explanation: `Le radical de ${kanji.literal} est ${kanji.radical.literal}${kanji.radical.nameFr ? ` (${kanji.radical.nameFr})` : ''}.`,
        difficulty: 2,
        variantKey: String(variant),
        sourceId: 'kanjipath_editorial',
      }),
    );
  }

  const strokeRng = seededRng(`stroke_count_qcm:${kanji.id}:${pack.version}`);
  const candidates = [kanji.strokeCount - 2, kanji.strokeCount - 1, kanji.strokeCount + 1, kanji.strokeCount + 2].filter(
    (n) => n >= 1 && n !== kanji.strokeCount,
  );
  exercises.push(
    makeExercise({
      template: 'stroke_count_qcm',
      skill: 'stroke',
      level: kanji.level,
      targetKanjiId: kanji.id,
      prompt: { kanji: kanji.literal, instruction: 'Combien de traits compte ce kanji ?' },
      acceptedAnswers: [String(kanji.strokeCount)],
      distractors: pickSeeded(strokeRng, candidates.map(String), 3),
      explanation: `${kanji.literal} s'écrit en ${kanji.strokeCount} traits.`,
      difficulty: 2,
      variantKey: '0',
      sourceId: 'kanjidic2',
    }),
  );

  if (kanji.components.length >= 2) {
    const compRng = seededRng(`component_selection_qcm:${kanji.id}:${pack.version}`);
    const answer = kanji.components.map((c) => c.literal).join(' ');
    const distractorLists = [];
    let attempts = 0;
    while (distractorLists.length < 3 && attempts < 40) {
      attempts += 1;
      const replaced = [...kanji.components.map((c) => c.literal)];
      const swapIndex = Math.floor(compRng() * replaced.length);
      const replacement = pickSeeded(compRng, componentsPool.filter((l) => !replaced.includes(l)), 1)[0];
      if (!replacement) {
        continue;
      }
      replaced[swapIndex] = replacement;
      const candidate = replaced.join(' ');
      if (normalizeAnswer(candidate) === normalizeAnswer(answer) || distractorLists.some((d) => normalizeAnswer(d) === normalizeAnswer(candidate))) {
        continue;
      }
      distractorLists.push(candidate);
    }
    exercises.push(
      makeExercise({
        template: 'component_selection_qcm',
        skill: 'stroke',
        level: kanji.level,
        targetKanjiId: kanji.id,
        prompt: { kanji: kanji.literal, instruction: 'Quels composants forment ce kanji ?' },
        acceptedAnswers: [answer],
        distractors: distractorLists,
        explanation: `${kanji.literal} est composé de : ${answer}.`,
        difficulty: 3,
        variantKey: '0',
        sourceId: 'kradfile',
      }),
    );
  }

  if (kanji.components.length > 0) {
    const byComponent = new Map();
    for (const k of pack.kanji) {
      for (const c of k.components) {
        if (!byComponent.has(c.literal)) {
          byComponent.set(c.literal, []);
        }
        byComponent.get(c.literal).push(k.literal);
      }
    }
    const component = kanji.components[0];
    const searchRng = seededRng(`component_search_qcm:${kanji.id}:${pack.version}`);
    const nonMatching = pack.kanji
      .filter((k) => k.id !== kanji.id && !k.components.some((c) => c.literal === component.literal))
      .map((k) => k.literal);
    const distractors = pickSeeded(searchRng, nonMatching, 3);
    if (distractors.length === 3) {
      exercises.push(
        makeExercise({
          template: 'component_search_qcm',
          skill: 'stroke',
          level: kanji.level,
          targetKanjiId: kanji.id,
          prompt: {
            component: component.literal,
            componentName: component.nameFr,
            instruction: 'Quel kanji contient ce composant ?',
          },
          acceptedAnswers: [kanji.literal],
          distractors,
          explanation: `${kanji.literal} contient le composant ${component.literal}.`,
          difficulty: 3,
          variantKey: '0',
          sourceId: 'kradfile',
        }),
      );
    }
  }

  return exercises;
}

export function generateConfusionExercises(pack, ctx, kanji) {
  const exercises = [];
  const words = ctx.vocabByKanji.get(kanji.id) ?? [];
  const confusionPool = kanji.confusions.filter((literal) => ctx.kanjiByLiteral.has(literal));
  const fallbackPool = pack.kanji.filter((k) => k.id !== kanji.id).map((k) => k.literal);

  for (let variant = 0; variant < 4; variant += 1) {
    const rng = seededRng(`confusion_pair_qcm:${kanji.id}:${variant}:${pack.version}`);
    if (words.length > 0) {
      const { vocab } = words[variant % words.length];
      const blanked = vocab.writtenForm.split(kanji.literal).join('＿');
      const distractorSource = confusionPool.length > 0 ? [...confusionPool, ...fallbackPool] : fallbackPool;
      const distractors = pickSeeded(rng, distractorSource.filter((l) => l !== kanji.literal), 3);
      exercises.push(
        makeExercise({
          template: 'confusion_pair_qcm',
          skill: 'meaning',
          level: kanji.level,
          targetKanjiId: kanji.id,
          vocabularyId: vocab.id,
          prompt: {
            word: blanked,
            meaning: vocab.meaningFr,
            instruction: 'Quel kanji complète ce mot ?',
          },
          acceptedAnswers: [kanji.literal],
          distractors,
          explanation: `${vocab.writtenForm} signifie « ${vocab.meaningFr} » — attention aux kanji visuellement proches.`,
          difficulty: 3,
          variantKey: String(variant),
          sourceId: 'kanjipath_editorial',
        }),
      );
    } else {
      const meaning = primaryMeaning(kanji);
      const distractorSource = confusionPool.length > 0 ? [...confusionPool, ...fallbackPool] : fallbackPool;
      const distractors = pickSeeded(rng, distractorSource.filter((l) => l !== kanji.literal), 3);
      exercises.push(
        makeExercise({
          template: 'confusion_pair_qcm',
          skill: 'meaning',
          level: kanji.level,
          targetKanjiId: kanji.id,
          prompt: { meaning, instruction: 'Quel kanji correspond à ce sens ? Attention aux confusions visuelles.' },
          acceptedAnswers: [kanji.literal],
          distractors,
          explanation: `« ${meaning} » s'écrit ${kanji.literal}.`,
          difficulty: 3,
          variantKey: String(variant),
          sourceId: 'kanjipath_editorial',
        }),
      );
    }
  }
  return exercises;
}

export function generateForKanji(pack, ctx, kanji) {
  return [
    ...generateMeaningExercises(pack, ctx, kanji),
    ...generateReadingExercises(pack, ctx, kanji),
    ...generateVocabularyExercises(pack, ctx, kanji),
    ...generateAdvancedReadingExercises(pack, ctx, kanji),
    ...generateContextExercises(pack, ctx, kanji),
    ...generateStrokeExercises(pack, ctx, kanji),
    ...generateConfusionExercises(pack, ctx, kanji),
  ];
}
