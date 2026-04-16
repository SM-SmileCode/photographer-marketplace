import { deliveryTranslation } from './translations/delivery';
import { useLanguage } from '../context/LanguageContext';

export function useDeliveryTranslation() {
  const { lang } = useLanguage();

  const t = (key) => {
    const keys = key.split('.');
    let value = deliveryTranslation[lang] ?? deliveryTranslation['en'];
    for (const k of keys) value = value?.[k];
    if (value === undefined) {
      let fallback = deliveryTranslation['en'];
      for (const k of keys) fallback = fallback?.[k];
      return fallback || key;
    }
    return value;
  };

  return { t };
}
