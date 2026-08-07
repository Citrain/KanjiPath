import { describe, expect, it } from 'vitest';
import { sanitizeKanjiSvg } from '../stages/normalize.mjs';

const SAMPLE = [
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:kvg="http://kanjivg.tagaini.net"',
  ' viewBox="0 0 109 109" width="109" height="109">',
  '<g id="kvg:StrokePaths_04e00" kvg:element="一">',
  '<g id="kvg:04e00" kvg:element="一" kvg:original="一" kvg:part="1">',
  '<path id="kvg:04e00-s1" d="M11,54.25c3.19,0.62,6.25,0.75,9.73,0.5"/>',
  '</g></g>',
  '<g id="kvg:StrokeNumbers_04e00"><text transform="translate(10 10)">1</text></g>',
  '</svg>',
].join('');

describe('sanitizeKanjiSvg', () => {
  it('conserve la structure svg/g/path avec les attributs autorisés', () => {
    const out = sanitizeKanjiSvg(SAMPLE);
    expect(out).toContain(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 109 109" width="109" height="109">',
    );
    expect(out).toContain('id="kvg:04e00-s1"');
    expect(out).toContain('d="M11,54.25c3.19,0.62,6.25,0.75,9.73,0.5"');
    expect(out.endsWith('</svg>')).toBe(true);
  });

  it('supprime tout attribut portant un préfixe kvg: (XML sans namespace déclaré)', () => {
    const out = sanitizeKanjiSvg(SAMPLE);
    expect(out).not.toMatch(/ kvg:[a-z]+="/);
    expect(out).not.toContain('kvg:element');
    expect(out).not.toContain('kvg:original');
    expect(out).not.toContain('kvg:part');
    expect(out).not.toContain('xmlns:kvg');
  });

  it('écarte les balises non autorisées', () => {
    const out = sanitizeKanjiSvg(SAMPLE);
    expect(out).not.toContain('<text');
    expect(out).not.toContain('</text');
  });
});
