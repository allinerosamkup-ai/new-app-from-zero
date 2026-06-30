import { MD3LightTheme } from 'react-native-paper';

export const appColors = {
  // Design tokens — aligned with web app
  nectarine: '#D7897F',
  menthe: '#96C7B3',
  lagune: '#6398A9',
  background: '#FAF8F5',
  surface: '#FFFFFF',
  text1: '#1A1A1A',
  text2: '#4A4A4A',
  text3: '#8A8A8A',
  border: 'rgba(0,0,0,0.07)',
  borderWarm: 'rgba(215,137,127,0.18)',

  // Legacy aliases — kept for backwards compatibility
  primary: '#D7897F',
  primaryStrong: '#c47a70',
  primarySoft: 'rgba(215,137,127,0.16)',
  surfaceAlt: 'rgba(250,248,245,0.92)',
  textPrimary: '#1A1A1A',
  textSecondary: '#4A4A4A',
  borderSubtle: 'rgba(215,137,127,0.18)',
  success: '#96C7B3',
  info: '#6398A9',
  danger: '#c05a55',
};

export const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: appColors.nectarine,
    secondary: appColors.menthe,
    tertiary: appColors.lagune,
    background: appColors.background,
    surface: appColors.surface,
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
    onTertiary: '#FFFFFF',
    onBackground: appColors.text1,
    onSurface: appColors.text1,
    outline: appColors.border,
  },
};

export const appSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const appRadius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
};

export const appTypography = {
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500' as const,
  },
  body: {
    fontSize: 14,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
  },
};

export const appGlass = {
  cardBorder: 'rgba(255,255,255,0.55)',
  cardShadow: '#D7897F22',
};

export const appTabBarConfig = {
  height: 72,
  paddingBottom: 10,
  paddingTop: 10,
};
