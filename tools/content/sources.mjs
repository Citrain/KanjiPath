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
  tatoeba_audio: {
    id: 'tatoeba_audio',
    name: 'Tatoeba - enregistrements japonais sélectionnés',
    url: 'https://tatoeba.org/en/downloads',
    license: 'Audio : CC BY 4.0 ; textes associés : CC BY 2.0 FR',
    attributionText:
      'Enregistrements japonais Tatoeba sélectionnés individuellement sous CC BY 4.0 : audio 1283521, 1283538 et 1283544 par fal via Tatoeba (CC BY 4.0). Attribution du locuteur, de Tatoeba et de la licence conservée par clip. Les textes associés conservent séparément leur auteur et leur licence CC BY 2.0 FR.',
    files: [
      {
        file: 'tatoeba-audio-1283521.mp3',
        url: 'https://api.tatoeba.org/v1/audios/1283521/file',
        version: '2026-08-08',
        sha256: 'a65a509700d64a5544f772e56c32b7627213a159959ffc2bb769038bc8f10450',
      },
      {
        file: 'tatoeba-audio-1283538.mp3',
        url: 'https://api.tatoeba.org/v1/audios/1283538/file',
        version: '2026-08-08',
        sha256: '7f35132d0b6a24d37fef350b927272e4b208bb5b6a2f9129ef6e7ab2a75c78e3',
      },
      {
        file: 'tatoeba-audio-1283544.mp3',
        url: 'https://api.tatoeba.org/v1/audios/1283544/file',
        version: '2026-08-08',
        sha256: 'ae2f859262ac19f9896d716b1329d7608ccdbe20617ca64ce239d32d26c5e27d',
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
      'Traductions françaises, mnémotechniques, notes, exercices, phrases curatées et mini-textes créés pour KanjiPath.',
    files: [],
  },
};

export const SOURCE_ORDER = [
  'kanjidic2',
  'jmdict',
  'kradfile',
  'kanjivg',
  'tatoeba',
  'tatoeba_audio',
  'kanji_data',
  'kanjipath_editorial',
];
