const HIRAGANA_ROMAJI = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'wi', ゑ: 'we', を: 'o', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ゔ: 'vu',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゕ: 'ka', ゖ: 'ke', ゎ: 'wa',
};

const YOUN_CONSONANTS = {
  き: 'ky', ぎ: 'gy', し: 'sh', じ: 'j', ち: 'ch', ぢ: 'j', に: 'ny',
  ひ: 'hy', び: 'by', ぴ: 'py', み: 'my', り: 'ry',
};

const YOUN_VOWELS = { ゃ: 'a', ゅ: 'u', ょ: 'o' };

const LONG_VOWELS = { a: 'ā', i: 'ī', u: 'ū', e: 'ē', o: 'ō' };

const VOWEL_EXTENSIONS = {
  a: new Set(['あ']),
  i: new Set(['い']),
  u: new Set(['う']),
  e: new Set(['え']),
  o: new Set(['う', 'お']),
};

const PURE_VOWELS = new Set(['あ', 'い', 'う', 'え', 'お']);

const N_LABIALS = new Set(['ば', 'び', 'ぶ', 'べ', 'ぼ', 'ま', 'み', 'む', 'め', 'も', 'ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ']);
const N_GLADES = new Set(['あ', 'い', 'う', 'え', 'お', 'や', 'ゆ', 'よ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ゃ', 'ゅ', 'ょ']);

export function katakanaToHiragana(text) {
  let out = '';
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    if (code >= 0x30a1 && code <= 0x30f6) {
      out += String.fromCodePoint(code - 0x60);
    } else {
      out += ch;
    }
  }
  return out;
}

export function kanaToRomaji(input) {
  const chars = [...katakanaToHiragana(String(input))];
  let out = '';
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    const next = chars[i + 1];

    if (ch === 'っ') {
      const follow = singleRomaji(next);
      if (follow) {
        out += follow.startsWith('ch') ? 't' : follow[0];
      }
      continue;
    }
    if (ch === 'ん') {
      if (next && N_GLADES.has(next)) {
        out += "n'";
      } else if (next && N_LABIALS.has(next)) {
        out += 'm';
      } else {
        out += 'n';
      }
      continue;
    }
    if (ch === 'ー') {
      const last = out[out.length - 1];
      if (last && LONG_VOWELS[last]) {
        out = out.slice(0, -1) + LONG_VOWELS[last];
      }
      continue;
    }
    if (next && YOUN_CONSONANTS[ch] && YOUN_VOWELS[next]) {
      out += YOUN_CONSONANTS[ch] + YOUN_VOWELS[next];
      i += 1;
      continue;
    }
    out += singleRomaji(ch) ?? ch;
  }
  return foldLongVowels(out);
}

const VOWEL_PAIRS = { aa: 'ā', ii: 'ī', uu: 'ū', ee: 'ē', oo: 'ō', ou: 'ō' };

function foldLongVowels(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const pair = text.slice(i, i + 2);
    if (VOWEL_PAIRS[pair]) {
      out += VOWEL_PAIRS[pair];
      i += 2;
    } else {
      out += text[i];
      i += 1;
    }
  }
  return out;
}

function singleRomaji(ch) {
  if (!ch) {
    return null;
  }
  return HIRAGANA_ROMAJI[ch] ?? null;
}
