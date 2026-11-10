import React from 'react';
import { Languages } from 'lucide-react';
import { useI18n, LANGUAGES } from '../../i18n/I18nProvider';
import type { LanguageCode } from '../../i18n/languages';

/** Compact language switcher (native names, so people can find their own language without reading English) */
export const LanguagePicker: React.FC<{ className?: string; id?: string }> = ({ className = '', id = 'language-picker' }) => {
  const { language, setLanguage, t } = useI18n();
  return (
    <label htmlFor={id} className={`inline-flex items-center gap-1.5 text-xs text-ink-secondary ${className}`}>
      <Languages className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span className="sr-only">{t('lang.label')}</span>
      <select
        id={id}
        value={language}
        onChange={(e) => setLanguage(e.target.value as LanguageCode)}
        className="bg-transparent border border-line-border rounded-lg px-2 py-1.5 min-h-[36px] text-xs font-semibold text-ink-main focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native}
          </option>
        ))}
      </select>
    </label>
  );
};
