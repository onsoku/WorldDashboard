import { useState, useEffect, type ReactNode } from 'react';
import {
  SettingsContext, loadSettings, saveSettings,
  type Settings, type Theme, type Language,
} from '@/context/settings-context';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    saveSettings(settings);
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings]);

  const setTheme = (theme: Theme) => setSettings(prev => ({ ...prev, theme }));
  const setLanguage = (language: Language) => setSettings(prev => ({ ...prev, language }));

  return (
    <SettingsContext.Provider value={{ settings, setTheme, setLanguage }}>
      {children}
    </SettingsContext.Provider>
  );
}
