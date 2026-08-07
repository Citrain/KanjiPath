export const SOURCES = {
  kanjidic2: {
    id: 'kanjidic2',
    name: 'KANJIDIC2',
    url: 'https://www.edrdg.org/wiki/index.php/KANJIDIC_Project',
    license: 'CC BY-SA 4.0 (licence EDRDG)',
    attributionText:
      'Données KANJIDIC2 de l’Electronic Dictionary Research and Development Group, sous licence CC BY-SA 4.0 (https://www.edrdg.org/edrdg/licence.html).',
    files: [
      {
        file: 'kanjidic2.xml.gz',
        url: 'https://www.edrdg.org/kanjidic/kanjidic2.xml.gz',
      },
    ],
  },
  jmdict: {
    id: 'jmdict',
    name: 'JMdict (multilingue, glosses françaises)',
    url: 'https://www.edrdg.org/jmdict/j_jmdict.html',
    license: 'CC BY-SA 4.0 (licence EDRDG)',
    attributionText:
      'Données JMdict de l’Electronic Dictionary Research and Development Group, sous licence CC BY-SA 4.0 (https://www.edrdg.org/edrdg/licence.html).',
    files: [
      {
        file: 'JMdict.gz',
        url: 'https://www.edrdg.org/pub/Nihongo/JMdict.gz',
      },
    ],
  },
  kradfile: {
    id: 'kradfile',
    name: 'KRADFILE (EDRDG), conversion Unicode/JSON',
    url: 'https://github.com/hoffmannjp/krad-unicode',
    license: 'CC BY-SA 3.0 (licence EDRDG)',
    attributionText:
      'Décomposition en composants d’après KRADFILE/RADKFILE de l’Electronic Dictionary Research and Development Group (licence EDRDG, CC BY-SA), conversion Unicode/JSON par hoffmannjp/krad-unicode.',
    files: [
      {
        file: 'krad.json',
        url: 'https://raw.githubusercontent.com/hoffmannjp/krad-unicode/master/krad.json',
      },
      {
        file: 'krad_components.json',
        url: 'https://raw.githubusercontent.com/hoffmannjp/krad-unicode/master/krad_components.json',
      },
    ],
  },
  kanjivg: {
    id: 'kanjivg',
    name: 'KanjiVG',
    url: 'https://kanjivg.tagaini.net',
    license: 'CC BY-SA 3.0',
    attributionText:
      'Tracés de kanji issus de KanjiVG (https://kanjivg.tagaini.net), par Ulrich Apel et les contributeurs, sous licence CC BY-SA 3.0.',
    files: [
      {
        file: 'kanjivg-main.zip',
        url: 'https://github.com/KanjiVG/kanjivg/releases/download/r20250816/kanjivg-20250816-main.zip',
        version: 'r20250816',
      },
    ],
  },
  tatoeba: {
    id: 'tatoeba',
    name: 'Tatoeba',
    url: 'https://tatoeba.org',
    license: 'CC BY 2.0 FR (licences par défaut Tatoeba, attribution par auteur)',
    attributionText:
      'Phrases d’exemple issues de Tatoeba (https://tatoeba.org), sous licence CC BY 2.0 FR. Chaque phrase est attribuée à son auteur dans l’interface et sur la page sources. Les phrases sans auteur connu sont attribuées à « Tatoeba ».',
    files: [
      {
        file: 'jpn_sentences_detailed.tsv.bz2',
        url: 'https://downloads.tatoeba.org/exports/per_language/jpn/jpn_sentences_detailed.tsv.bz2',
      },
      {
        file: 'fra_sentences_detailed.tsv.bz2',
        url: 'https://downloads.tatoeba.org/exports/per_language/fra/fra_sentences_detailed.tsv.bz2',
      },
      {
        file: 'links.tar.bz2',
        url: 'https://downloads.tatoeba.org/exports/links.tar.bz2',
      },
    ],
  },
  kanji_data: {
    id: 'kanji_data',
    name: 'kanji-data (David Gouveia)',
    url: 'https://github.com/davidluzgouveia/kanji-data',
    license: 'MIT',
    attributionText:
      'Niveaux JLPT indicatifs croisés depuis kanji-data (David Gouveia, licence MIT), lui-même agrégé à partir de listes publiques.',
    files: [
      {
        file: 'kanji-data.json',
        url: 'https://raw.githubusercontent.com/davidluzgouveia/kanji-data/master/kanji.json',
      },
    ],
  },
  kanjipath_editorial: {
    id: 'kanjipath_editorial',
    name: 'Contenu éditorial KanjiPath',
    url: 'https://github.com/',
    license: 'CC BY-SA 4.0',
    attributionText:
      'Traductions françaises, mnémotechniques, notes et exercices créés pour KanjiPath.',
    files: [],
  },
};

export const SOURCE_ORDER = [
  'kanjidic2',
  'jmdict',
  'kradfile',
  'kanjivg',
  'tatoeba',
  'kanji_data',
  'kanjipath_editorial',
];
