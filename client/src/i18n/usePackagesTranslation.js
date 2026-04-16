import { packagesTranslations } from './translations/package';
import { useLanguage } from '../context/LanguageContext';

export function usePackagesTranslation() {
  const { lang } = useLanguage();

  const t = (key) => {
    const keys = key.split('.');
    let value = packagesTranslations[lang] ?? packagesTranslations['en'];
    for (const k of keys) value = value?.[k];
    if (value === undefined) {
      let fallback = packagesTranslations['en'];
      for (const k of keys) fallback = fallback?.[k];
      return fallback || key;
    }
    return value;
  };

  return { t };
}
