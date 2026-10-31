import { afterEach, describe, expect, it } from 'vitest';
import { broadcastLanguage, formatLocale, localizedLabel, localizedTerms, setLanguage, t } from './i18n';

afterEach(() => setLanguage('es'));

describe('language preferences', () => {
  it('persists the selected language and formats translated placeholders', () => {
    setLanguage('en', 'member-1');

    expect(localStorage.getItem('srd-last-language')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(formatLocale()).toBe('en-US');
    expect(t('Resultados: {count}', { count: 3 })).toBe('Results: 3');
    expect(t('Mi descripción escrita por la persona')).toBe('Mi descripción escrita por la persona');
  });

  it('synchronizes an account language change received from another tab', () => {
    broadcastLanguage('es', 'member-1');
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'srd-language-member-1',
      newValue: 'en',
    }));

    expect(t('Documento')).toBe('Document');
    expect(localStorage.getItem('srd-last-language')).toBe('en');
  });

  it('uses English versions for junta-authored labels and terms with Spanish fallback', () => {
    setLanguage('en');

    expect(localizedLabel({ label: 'Actas', label_en: 'Minutes' })).toBe('Minutes');
    expect(localizedLabel({ label: 'Comunicados' })).toBe('Comunicados');
    expect(localizedTerms({ body: 'Texto vigente', body_en: 'Current text' })).toBe('Current text');
    expect(localizedTerms({ body: 'Texto solo en español', body_en: null })).toBe('Texto solo en español');

    setLanguage('es');
    expect(formatLocale()).toBe('es-CO');
  });
});
