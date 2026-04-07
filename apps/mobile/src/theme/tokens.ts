/**
 * Executive Concierge SP — Design Tokens
 * Premium, dark, minimal, elegant
 */

export const Colors = {
  // Brand
  gold: '#C9A96E',
  goldLight: '#E2C48A',
  goldDark: '#A8833A',

  // Neutrals (dark-first)
  black: '#0A0A0A',
  charcoal: '#141414',
  darkGray: '#1E1E1E',
  midGray: '#2C2C2C',
  gray: '#5A5A5A',
  lightGray: '#9A9A9A',
  offWhite: '#E8E5E0',
  white: '#FFFFFF',

  // Semantic
  success: '#4CAF50',
  error: '#E53935',
  warning: '#FFB300',
  info: '#1976D2',

  // Backgrounds
  background: '#0A0A0A',
  surface: '#141414',
  surfaceElevated: '#1E1E1E',
  border: '#2C2C2C',
  borderLight: '#3C3C3C',
};

export const Typography = {
  // Font families
  fontFamily: {
    serif: 'Georgia', // Used for headings — luxury feel
    sansSerif: 'System', // Used for body text
    mono: 'Courier New',
  },

  // Font sizes
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    '2xl': 28,
    '3xl': 34,
    '4xl': 40,
  },

  // Font weights
  fontWeight: {
    light: '300' as const,
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.7,
  },

  // Letter spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
    widest: 2,
  },
};

export const Spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
};

export const BorderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
};

export const Animation = {
  fast: 150,
  normal: 250,
  slow: 400,
};
