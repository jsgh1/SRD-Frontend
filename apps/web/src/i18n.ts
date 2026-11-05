import { useSyncExternalStore } from 'react';
import { english } from './i18n-dictionaries';

export type Language = 'es' | 'en';

// Product copy is keyed by its Spanish source. User-authored content is kept separate.
// A missing English entry deliberately falls back to Spanish so gaps remain visible.
const knownEnglishCopy = new Set(Object.values(english));

let currentLanguage: Language = localStorage.getItem('srd-last-language') === 'en' ? 'en' : 'es';
let currentUser: string | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => currentLanguage;
document.documentElement.lang = currentLanguage;

export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, snapshot, () => 'es');
}

export function setLanguage(value: string | undefined, userId: string | null = null): void {
  const next: Language = value === 'en' ? 'en' : 'es';
  currentUser = userId;
  document.documentElement.lang = next;
  localStorage.setItem('srd-last-language', next);
  if (next === currentLanguage) return;
  currentLanguage = next;
  listeners.forEach(listener => listener());
}

export function broadcastLanguage(value: Language, userId: string): void {
  setLanguage(value, userId);
  localStorage.setItem(`srd-language-${userId}`, value);
}

window.addEventListener('storage', event => {
  if (currentUser && event.key === `srd-language-${currentUser}` && event.newValue) {
    setLanguage(event.newValue, currentUser);
  }
});

export function t(source: string, values: Record<string, string | number> = {}): string {
  const text = currentLanguage === 'en' ? english[source] ?? source : source;
  return text.replace(/\{([a-zA-Z]+)\}/g, (match, key: string) => String(values[key] ?? match));
}

export function formatLocale(): string { return currentLanguage === 'en' ? 'en-US' : 'es-CO'; }

export function localizedTerms(terms: { body: string; body_en?: string | null }): string {
  return currentLanguage === 'en' && terms.body_en ? terms.body_en : terms.body;
}

export function localizedLabel(value: { label: string; label_en?: string | null }): string {
  return currentLanguage === 'en' && value.label_en ? value.label_en : value.label;
}

export function translateToEnglish(source: string): string { return english[source] ?? source; }
export function isKnownEnglishCopy(source: string): boolean { return knownEnglishCopy.has(source); }
