import path from 'node:path';
import { fileURLToPath } from 'node:url';
import kuromoji from 'kuromoji';
import { kanaToRomaji, katakanaToHiragana } from './romaji.mjs';

const KANJI_RE = /[\u3400-\u9fff\uf900-\ufaff]/;
const MONTH_PREFIXES = {
  1: 'いち',
  2: 'に',
  3: 'さん',
  4: 'し',
  5: 'ご',
  6: 'ろく',
  7: 'しち',
  8: 'はち',
  9: 'く',
  10: 'じゅう',
  11: 'じゅういち',
  12: 'じゅうに',
};

let tokenizerPromise = null;

export function createTokenizer() {
  if (!tokenizerPromise) {
    const kuromojiPath = fileURLToPath(import.meta.resolve('kuromoji'));
    const dicPath = path.join(path.dirname(kuromojiPath), '..', 'dict');
    tokenizerPromise = new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath }).build((error, tokenizer) => {
        if (error) {
          reject(error);
        } else {
          resolve(tokenizer);
        }
      });
    });
  }
  return tokenizerPromise;
}

export function hasKanji(text) {
  return KANJI_RE.test(text);
}

function numericMonthPrefix(text) {
  const normalized = text.normalize('NFKC');
  if (!/^\d{1,2}$/.test(normalized)) {
    return null;
  }
  return MONTH_PREFIXES[Number(normalized)] ?? null;
}

export function annotateSentence(tokenizer, japanese) {
  const rawTokens = tokenizer.tokenize(japanese);
  const tokens = [];
  let cursor = 0;
  for (const token of rawTokens) {
    const surface = token.surface_form;
    let startOffset = token.word_position - 1;
    if (japanese.slice(startOffset, startOffset + surface.length) !== surface) {
      startOffset = japanese.indexOf(surface, cursor);
      if (startOffset === -1) {
        throw new Error(`Tokenisation incohérente pour « ${japanese} »`);
      }
    }
    cursor = startOffset + surface.length;

    let reading = null;
    let romaji = null;
    if (hasKanji(surface)) {
      if (!token.reading || !hasKanaOrKanji(token.reading)) {
        return null;
      }
      reading = katakanaToHiragana(token.reading);
      romaji = kanaToRomaji(token.reading);
    } else {
      reading = surface;
      const pronunciation = token.pronunciation && hasKana(token.pronunciation) ? token.pronunciation : surface;
      romaji = hasKana(pronunciation) ? kanaToRomaji(pronunciation) : null;
    }
    const endOffset = startOffset + surface.length;
    const previous = tokens[tokens.length - 1];
    const monthPrefix = surface === '月' && previous?.endOffset === startOffset ? numericMonthPrefix(previous.surface) : null;
    if (monthPrefix) {
      const monthReading = `${monthPrefix}がつ`;
      tokens.pop();
      tokens.push({
        surface: `${previous.surface}${surface}`,
        reading: monthReading,
        romaji: kanaToRomaji(monthReading),
        startOffset: previous.startOffset,
        endOffset,
      });
      continue;
    }
    tokens.push({ surface, reading, romaji, startOffset, endOffset });
  }
  return tokens;
}

function hasKanaOrKanji(text) {
  return /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/.test(text);
}

function hasKana(text) {
  return /[\u3040-\u30ff]/.test(text);
}
