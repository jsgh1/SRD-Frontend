import { afterEach, describe, expect, it } from 'vitest';
import { english, englishDictionaries } from './i18n-dictionaries';
import { isKnownEnglishCopy, setLanguage, t, translateToEnglish } from './i18n';
import { originalEnglishDictionary } from '../test-fixtures/i18n-english-reference';

afterEach(() => setLanguage('es'));

describe('modular English catalog equivalence', () => {
  it('keeps the complete pre-refactor key/value map without cross-domain duplicates', () => {
    const sourceEntryCount = englishDictionaries.reduce((total, dictionary) => total + Object.keys(dictionary).length, 0);
    expect(sourceEntryCount).toBe(Object.keys(english).length);
    expect(english).toEqual(originalEnglishDictionary);
  });

  it('preserves every English value and replacement for its original placeholders', () => {
    setLanguage('en');
    for (const [source, expected] of Object.entries(originalEnglishDictionary)) {
      expect(translateToEnglish(source)).toBe(expected);
      const placeholders = [...expected.matchAll(/\{([a-zA-Z]+)\}/g)];
      const values = Object.fromEntries(placeholders.map(([, name]) => [name, `P41_${name}`]));
      const rendered = expected.replace(/\{([a-zA-Z]+)\}/g, (_match, name: string) => String(values[name]));
      expect(t(source, values)).toBe(rendered);
    }
  });

  it('preserves Spanish source copy, fallback, and known English copy membership', () => {
    for (const source of Object.keys(originalEnglishDictionary)) expect(t(source)).toBe(source);
    setLanguage('en');
    for (const value of new Set(Object.values(originalEnglishDictionary))) {
      expect(isKnownEnglishCopy(value)).toBe(true);
    }
    expect(t('P41 unknown source copy')).toBe('P41 unknown source copy');
    expect(translateToEnglish('P41 unknown source copy')).toBe('P41 unknown source copy');
    expect(isKnownEnglishCopy('P41 unknown translated copy')).toBe(false);
  });
});
