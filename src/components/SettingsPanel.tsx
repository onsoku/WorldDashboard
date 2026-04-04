import { useState, useRef, useEffect } from 'react';
import { Settings, Sun, Moon, Monitor } from 'lucide-react';
import { useSettings, type Theme, type Language } from '@/context/SettingsContext';
import { useTranslation } from '@/i18n/useTranslation';

const THEME_OPTIONS: { value: Theme; icon: typeof Sun; key: string }[] = [
  { value: 'light', icon: Sun, key: 'settings.light' },
  { value: 'dark', icon: Moon, key: 'settings.dark' },
  { value: 'mono', icon: Monitor, key: 'settings.mono' },
];

const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文' },
  { value: 'es', label: 'Espanol' },
  { value: 'it', label: 'Italiano' },
  { value: 'fr', label: 'Francais' },
];

export function SettingsPanel() {
  const { settings, setTheme, setLanguage } = useSettings();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-md transition-colors hover:theme-bg-hover theme-text-secondary"
        title="Settings"
      >
        <Settings className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 theme-bg-card border theme-border rounded-lg shadow-lg z-50 p-3 space-y-4">
          {/* Theme */}
          <div>
            <label className="text-xs font-medium theme-text-secondary mb-1.5 block">
              {t('settings.theme')}
            </label>
            <div className="flex gap-1">
              {THEME_OPTIONS.map(({ value, icon: Icon, key }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md border transition-colors ${
                    settings.theme === value
                      ? 'theme-primary text-white border-transparent'
                      : 'theme-bg-input theme-border theme-text-secondary hover:theme-bg-hover'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t(key)}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <label className="text-xs font-medium theme-text-secondary mb-1.5 block">
              {t('settings.language')}
            </label>
            <select
              value={settings.language}
              onChange={e => setLanguage(e.target.value as Language)}
              className="w-full text-sm px-2 py-1.5 rounded-md border theme-border theme-bg-input theme-text focus:outline-none focus:ring-2 theme-ring"
            >
              {LANGUAGE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
