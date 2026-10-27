import {createContext, useContext, useMemo} from 'react';

export type SrdThemeMode = 'light' | 'dark';

export type SrdTheme = {
  mode: SrdThemeMode;
  colors: {
    accent: string;
    accentSoft: string;
    background: string;
    surface: string;
    surfaceSoft: string;
    ink: string;
    muted: string;
    border: string;
    placeholder: string;
    danger: string;
    dangerSoft: string;
    error: string;
    errorSoft: string;
    errorBorder: string;
    success: string;
    successSoft: string;
    successBorder: string;
    warning: string;
    warningSoft: string;
    warningBorder: string;
    focus: string;
    onAccent: string;
    shadow: string;
  };
  typography: {family: string; body: number; small: number; title: number; heading: number};
  radius: {control: number; card: number; panel: number};
  spacing: {xs: number; sm: number; md: number; lg: number; xl: number};
};

export const srdThemes: Record<SrdThemeMode, SrdTheme> = {
  light: {
    mode: 'light',
    colors: {
      accent: '#245bce', accentSoft: '#e7edfa', background: '#f5f7fb', surface: '#fff',
      surfaceSoft: '#f0f4fa', ink: '#1c2e49', muted: '#5e6e85', border: '#dfe5ee',
      placeholder: '#7e8ca1', danger: '#b43343', dangerSoft: '#fdecee', error: '#912035',
      errorSoft: '#fff0f1', errorBorder: '#edb2ba', success: '#1c6645', successSoft: '#e5f5ed',
      successBorder: '#a8d6bd', warning: '#633d12', warningSoft: '#fff4df', warningBorder: '#e2b46e',
      focus: '#76a7fa', onAccent: '#ffffff', shadow: '#1b345a08',
    },
    typography: {family: 'PublicSans', body: 15, small: 12, title: 30, heading: 19},
    radius: {control: 8, card: 11, panel: 12}, spacing: {xs: 4, sm: 8, md: 14, lg: 20, xl: 25},
  },
  dark: {
    mode: 'dark',
    colors: {
      accent: '#245bce', accentSoft: '#1a2b48', background: '#111a28', surface: '#192537',
      surfaceSoft: '#223149', ink: '#e5ecf7', muted: '#adbcd1', border: '#34445c',
      placeholder: '#adbcd1', danger: '#ff9aa7', dangerSoft: '#492c38', error: '#ffccd5',
      errorSoft: '#38222c', errorBorder: '#914d61', success: '#c7f4dd', successSoft: '#183b32',
      successBorder: '#3e8a70', warning: '#633d12', warningSoft: '#fff4df', warningBorder: '#e2b46e',
      focus: '#76a7fa', onAccent: '#ffffff', shadow: 'transparent',
    },
    typography: {family: 'PublicSans', body: 15, small: 12, title: 30, heading: 19},
    radius: {control: 8, card: 11, panel: 12}, spacing: {xs: 4, sm: 8, md: 14, lg: 20, xl: 25},
  },
};

export const SrdThemeContext = createContext<SrdTheme>(srdThemes.light);

export function useSrdTheme(): SrdTheme {
  return useContext(SrdThemeContext);
}

export function useSrdStyles<T>(factory: (theme: SrdTheme) => T): T {
  const theme = useSrdTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}
