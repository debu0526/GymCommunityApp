/**
 * Design tokens — single source of truth for the app's look.
 * Dark-only, minimalist gunmetal + amber. Mirrors "Design System.md".
 * Never hardcode a hex or size in a screen — always import from here.
 */

export const colors = {
  bg: '#0E1113', // deepest / behind everything
  appBg: '#16191C', // default screen background
  surface: '#1F252A', // cards, list rows
  surface2: '#272E34', // elevated / highlighted cards
  hairline: '#333B42', // borders, dividers

  text: '#F1F4F5', // primary text
  text2: '#A7B0B7', // secondary text
  text3: '#6C757D', // muted labels / captions

  amber: '#FFA23A', // accent: buttons, streaks, PRs, active
  amberStrong: '#FF8C1A', // pressed amber
  amberDim: 'rgba(255,162,58,0.14)', // amber tint backgrounds
  onAmber: '#141518', // text/icons on amber fills

  success: '#5AD19A', // set done / positive
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  card: 20,
  pill: 999,
} as const;

/** Font family names as exported by @expo-google-fonts. */
export const fonts = {
  display: 'BebasNeue_400Regular',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const theme = { colors, spacing, radius, fonts };
export type Theme = typeof theme;
