import { Colors, Typography, Spacing, BorderRadius, Shadow } from './tokens';

export const theme = {
  colors: Colors,
  typography: Typography,
  spacing: Spacing,
  borderRadius: BorderRadius,
  shadow: Shadow,
} as const;

export type Theme = typeof theme;
export { Colors, Typography, Spacing, BorderRadius, Shadow };
