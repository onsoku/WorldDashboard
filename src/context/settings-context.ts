// Non-component half of the settings context.
//
// Kept out of SettingsContext.tsx because react-refresh requires a file that
// exports a component to export nothing else — mixing the hook and the
// provider in one file breaks Fast Refresh.

import { createContext, useContext } from 'react';

export type Theme = 'light' | 'dark' | 'mono';
export type Language = 'en' | 'ja' | 'zh' | 'es' | 'it' | 'fr';

export interface Settings {
  theme: Theme;
  language: Language;
}

export interface SettingsContextType {
  settings: Settings;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
}

const STORAGE_KEY = 'world-dashboard-settings';

export const defaultSettings: Settings = { theme: 'light', language: 'ja' };

export function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultSettings, ...parsed };
    }
  } catch { /* ignore */ }
  return defaultSettings;
}

export function saveSettings(settings: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export const SettingsContext = createContext<SettingsContextType | null>(null);

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
