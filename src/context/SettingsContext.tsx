import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'mono';
export type Language = 'en' | 'ja' | 'zh' | 'es' | 'it' | 'fr';

interface Settings {
  theme: Theme;
  language: Language;
}

interface SettingsContextType {
  settings: Settings;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
}

const STORAGE_KEY = 'world-dashboard-settings';

const defaultSettings: Settings = { theme: 'light', language: 'ja' };

function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultSettings, ...parsed };
    }
  } catch { /* ignore */ }
  return defaultSettings;
}

function saveSettings(settings: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

const SettingsContext = createContext<SettingsContextType | null>(null);

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

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
