import { useSettings } from '@/context/settings-context';
import translations from './translations';

export function useTranslation() {
  const { settings } = useSettings();
  const lang = settings.language;

  function t(key: string): string {
    return translations[lang]?.[key] ?? translations['en']?.[key] ?? key;
  }

  return { t, language: lang };
}
