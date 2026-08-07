import { describe, expect, it } from 'vitest';
import { kanaToRomaji, katakanaToHiragana } from '../lib/romaji.mjs';

describe('katakanaToHiragana', () => {
  it('convertit les katakana en hiragana', () => {
    expect(katakanaToHiragana('シチガツ')).toBe('しちがつ');
    expect(katakanaToHiragana('ロクジ')).toBe('ろくじ');
  });

  it('conserve les hiragana et la barre de prolongation', () => {
    expect(katakanaToHiragana('コーヒー')).toBe('こーひー');
  });
});

describe('kanaToRomaji', () => {
  it('transcrit les lectures de base', () => {
    expect(kanaToRomaji('いち')).toBe('ichi');
    expect(kanaToRomaji('イチ')).toBe('ichi');
    expect(kanaToRomaji('ひと')).toBe('hito');
    expect(kanaToRomaji('しちがつ')).toBe('shichigatsu');
    expect(kanaToRomaji('くじ')).toBe('kuji');
    expect(kanaToRomaji('じゅういちがつ')).toBe('jūichigatsu');
  });

  it("gère les digraphes (yôon)", () => {
    expect(kanaToRomaji('きゅう')).toBe('kyū');
    expect(kanaToRomaji('りょこう')).toBe('ryokō');
    expect(kanaToRomaji('しゃしん')).toBe('shashin');
  });

  it('gère le sokuon', () => {
    expect(kanaToRomaji('きって')).toBe('kitte');
    expect(kanaToRomaji('ざっし')).toBe('zasshi');
    expect(kanaToRomaji('みっち')).toBe('mitchi');
  });

  it('gère le n syllabique', () => {
    expect(kanaToRomaji('にほん')).toBe('nihon');
    expect(kanaToRomaji('しんぶん')).toBe('shimbun');
    expect(kanaToRomaji('でんわ')).toBe('denwa');
    expect(kanaToRomaji('さんま')).toBe('samma');
  });

  it('gère la barre de prolongation', () => {
    expect(kanaToRomaji('コーヒー')).toBe('kōhī');
    expect(kanaToRomaji('せんせい')).toBe('sensei');
  });

  it('conserve les caractères hors kana', () => {
    expect(kanaToRomaji('うまどし')).toBe('umadoshi');
  });
});
