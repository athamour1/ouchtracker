import en from './en';
import el from './el';

export const messages = { en, el };
export type Locale = 'en' | 'el';
export const LOCALES: { value: Locale; label: string; flag: string }[] = [
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'el', label: 'Ελληνικά', flag: '🇬🇷' },
];
