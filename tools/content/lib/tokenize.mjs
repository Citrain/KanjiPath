import path from 'node:path';
import { fileURLToPath } from 'node:url';
import kuromoji from 'kuromoji';
import { kanaToRomaji, katakanaToHiragana } from './romaji.mjs';

const KANJI_RE = /[\u3400-\u9fff\uf900-\ufaff]/;

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
    tokens.push({ surface, reading, romaji, startOffset, endOffset: startOffset + surface.length });
  }
  return tokens;
}

function hasKanaOrKanji(text) {
  return /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/.test(text);
}

function hasKana(text) {
  return /[\u3040-\u30ff]/.test(text);
}
