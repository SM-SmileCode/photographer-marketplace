import { bookingsTranslations } from './translations/bookings';
import { useLanguage } from '../context/LanguageContext';

export function useBookingsTranslation() {
  const { lang } = useLanguage();

  const t = (key) => {
    const keys = key.split('.');
    let value = bookingsTranslations[lang] ?? bookingsTranslations['en'];
    for (const k of keys) value = value?.[k];
    if (value === undefined) {
      let fallback = bookingsTranslations['en'];
      for (const k of keys) fallback = fallback?.[k];
      return fallback || key;
    }
    return value;
  };

  return { t };
}
