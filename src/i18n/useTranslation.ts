import React from 'react';
import { useAppSelector } from 'reduxs/store';
import { appSelector } from 'reduxs/reducers/app-reducer';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_LOCALES,
  LanguageCode,
  translate,
} from './translations';

export const useTranslation = () => {
  const language =
    (useAppSelector(appSelector).language as LanguageCode) || DEFAULT_LANGUAGE;
  const locale = LANGUAGE_LOCALES[language] ?? LANGUAGE_LOCALES[DEFAULT_LANGUAGE];

  const t = React.useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      translate(key, language, vars),
    [language]
  );

  return { t, language, locale };
};
