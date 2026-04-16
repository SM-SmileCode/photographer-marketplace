import { publicTranslations } from './translations/public';
import { useLanguage } from '../context/LanguageContext';

export function usePublicTranslation() {
  const { lang } = useLanguage();

  const t = (key) => {
    const keys = key.split('.');
    let value = publicTranslations[lang] ?? publicTranslations['en'];
    for (const k of keys) value = value?.[k];
    if (value === undefined) {
      let fallback = publicTranslations['en'];
      for (const k of keys) fallback = fallback?.[k];
      return fallback || key;
    }
    return value;
  };

  return { t };
}
