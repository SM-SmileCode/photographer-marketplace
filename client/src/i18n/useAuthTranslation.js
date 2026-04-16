import { authTranslations } from './translations/auth';
import { useLanguage } from '../context/LanguageContext';

export function useAuthTranslation() {
  const { lang } = useLanguage();

  const t = (key) => {
    const keys = key.split('.');
    let value = authTranslations[lang] ?? authTranslations['en'];
    for (const k of keys) {
      value = value?.[k];
    }
    // fallback to English if key missing in selected language
    if (value === undefined) {
      let fallback = authTranslations['en'];
      for (const k of keys) fallback = fallback?.[k];
      return fallback || key;
    }
    return value;
  };

  return { t };
}
