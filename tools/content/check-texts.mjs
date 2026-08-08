import fs from 'node:fs';
import path from 'node:path';
import { NORMALIZED_DIR } from './lib/paths.mjs';
import { annotateSentence, createTokenizer } from './lib/tokenize.mjs';
import { kanjiLiteralsOf } from './stages/normalize.mjs';

const drafts = [
  {
    title: '春の山',
    body: '四月になると、山の村にも春が来る。梅の花が咲き、やがて桜の季節がやってくる。朝、薄い霧が谷を覆い、鳥の声が静かに響く。村人は田んぼの準備を始め、子供たちは野原を走り回る。祭りの日には、太鼓の音が夜まで続き、神社には多くの人が集まる。桜の木の下で、人々は弁当を広げ、歌を歌い、太鼓を打つ。老人たちは昔の話を語り、子供たちは目を輝かせて聞く。春の山は、命にあふれている。道ばたには小さな花が咲き、小さな虫が動いている。今年もやって来た美しい季節は、自然の恵みである。',
  },
  {
    title: '夜の森',
    body: '深い森の夜は、暗さに包まれる。星の光が、木々の間から見える。月の光が木々の間から差し込み、地面に白い影を作る。ふくろうの声が遠くで響き、風の音が葉を揺らす。雷が鳴り、雨が降り出すと、動物たちは木の陰に身を隠す。水滴が葉に落ち、川の水が増えていく。やがて雨は上がり、森には静けさが戻る。朝になれば、鳥たちが歌い、新しい一日が始まる。森の命は終わりなく、永遠に続いていくのだ。',
  },
];

const kanji = JSON.parse(await fs.promises.readFile(path.join(NORMALIZED_DIR, 'kanji.json'), 'utf8'));
const referential = new Set(kanji.map((k) => k.literal));
const tokenizer = await createTokenizer();

for (const draft of drafts) {
  const literals = kanjiLiteralsOf(draft.body + draft.title);
  const hors = literals.filter((l) => !referential.has(l));
  console.log(`[${draft.title}] hors referentiel: ${hors.join('') || 'aucun'}`);
  const tokens = annotateSentence(tokenizer, draft.body);
  if (!tokens) {
    console.log(`[${draft.title}] ERREUR: lecture complete impossible`);
  } else {
    const bad = tokens.filter((t) => /[\u3400-\u9fff\uf900-\ufaff]/.test(t.surface) && (!t.reading || !t.romaji));
    console.log(`[${draft.title}] tokens: ${tokens.length}, sans lecture: ${bad.map((t) => t.surface).join(' ') || 'aucun'} | longueur: ${draft.body.length}`);
  }
}
