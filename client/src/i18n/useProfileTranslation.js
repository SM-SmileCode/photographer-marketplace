import { profileTranslations } from './translations/profile';
import { useLanguage } from '../context/LanguageContext';

export function useProfileTranslation() {
  const { lang } = useLanguage();

  const t = (key) => {
    const keys = key.split('.');
    let value = profileTranslations[lang] ?? profileTranslations['en'];
    for (const k of keys) value = value?.[k];
    if (value === undefined) {
      let fallback = profileTranslations['en'];
      for (const k of keys) fallback = fallback?.[k];
      return fallback || key;
    }
    return value;
  };

  return { t };
}
