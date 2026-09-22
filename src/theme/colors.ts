/**
 * Attendance Tracker — Color System
 * 
 * Re-architected with a raw palette and semantic tokens.
 * Inspired by Apple Liquid Glass, Linear, and Stripe aesthetics.
 */

import { Platform } from 'react-native';

// ─── Raw Palette ───────────────────────────────────────────────────
export const palette = {
  black: '#000000',
  white: '#FFFFFF',
  slate: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#020617',
  },
  emerald: {
    400: '#34D399',
    500: '#10B981',
    600: '#059669',
  },
  rose: {
    400: '#FB7185',
    500: '#F43F5E',
    600: '#E11D48',
  },
  amber: {
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
  },
  indigo: {
    400: '#818CF8',
    500: '#6366F1',
    600: '#4F46E5',
  },
  cyan: {
    400: '#22D3EE',
    500: '#06B6D4',
  },
  violet: {
    400: '#A78BFA',
    500: '#8B5CF6',
  },
  red: {
    500: '#EF4444',
    600: '#DC2626',
  },
  blue: {
    400: '#60a5fa',
    500: '#3b82f6',
  },
  lime: {
    500: '#84cc16',
  },
  orange: {
    500: '#f97316',
  },
  yellow: {
    500: '#eab308',
  }
} as const;

// ─── Opacity Scale ─────────────────────────────────────────────────
export const opacity = {
  subtle: 0.03,
  light: 0.06,
  medium: 0.08,
  strong: 0.12,
  heavy: 0.16,
  solid: 0.24,
  intense: 0.48,
} as const;

// ─── Canvas & Surface Layers ───────────────────────────────────────
export const canvas = {
  base: '#060912', // Deeper navy-black
  elevated: '#0C111C', 
  overlay: '#131A2A',
  popover: '#1A2338',
  backdrop: 'rgba(6, 9, 18, 0.85)',
} as const;

// ─── Glass & Frosted Surfaces ──────────────────────────────────────
export const glass = {
  subtle: `rgba(255, 255, 255, ${opacity.subtle})`,
  light: `rgba(255, 255, 255, ${opacity.light})`,
  medium: `rgba(255, 255, 255, ${opacity.medium})`,
  strong: `rgba(255, 255, 255, ${opacity.strong})`,
  heavy: `rgba(255, 255, 255, ${opacity.heavy})`, // Fix: Added missing heavy
} as const;

// ─── Borders ───────────────────────────────────────────────────────
export const border = {
  subtle: `rgba(255, 255, 255, ${opacity.subtle})`,
  default: `rgba(255, 255, 255, ${opacity.light})`,
  medium: `rgba(255, 255, 255, ${opacity.medium})`, // Fix: Renamed from muted
  strong: `rgba(255, 255, 255, ${opacity.strong})`,
} as const;

// ─── Text Hierarchy ────────────────────────────────────────────────
export const text = {
  primary: palette.slate[100],
  secondary: palette.slate[400],
  tertiary: palette.slate[500],
  disabled: palette.slate[600],
  inverse: canvas.base,
} as const;

// ─── Semantic Feedback & Status ────────────────────────────────────
export const feedback = {
  success: palette.emerald[500],
  error: palette.rose[500],
  warning: palette.amber[500],
  info: palette.indigo[500],
} as const;

// ─── Attendance Status ─────────────────────────────────────────────
export const attendance = {
  present: {
    base: feedback.success,
    light: `rgba(16, 185, 129, ${opacity.heavy})`,
    surface: `rgba(16, 185, 129, ${opacity.medium})`,
  },
  absent: {
    base: feedback.error,
    light: `rgba(244, 63, 94, ${opacity.heavy})`,
    surface: `rgba(244, 63, 94, ${opacity.medium})`,
  },
  cancelled: {
    base: feedback.warning,
    light: `rgba(245, 158, 11, ${opacity.heavy})`,
    surface: `rgba(245, 158, 11, ${opacity.medium})`,
  },
  proxy: {
    base: palette.blue[500],
    light: `rgba(59, 130, 246, ${opacity.heavy})`,
    surface: `rgba(59, 130, 246, ${opacity.medium})`,
  },


  missed: {
    base: palette.violet[500],
    light: `rgba(139, 92, 246, ${opacity.heavy})`,
    surface: `rgba(139, 92, 246, ${opacity.medium})`,
  },
} as const;

// ─── Gauge Colors ──────────────────────────────────────────────────
export const gauge = {
  safe: feedback.success,
  warning: feedback.warning,
  danger: feedback.error,
  critical: palette.red[600],
  track: glass.light,
} as const;

// ─── Accent & Brand ────────────────────────────────────────────────
export const accent = {
  primary: palette.indigo[500],
  primaryHover: palette.indigo[400],
  primarySurface: `rgba(99, 102, 241, ${opacity.strong})`,
  secondary: palette.cyan[500],
  secondarySurface: `rgba(34, 211, 238, ${opacity.strong})`,
} as const;

// ─── Gradient System (New) ─────────────────────────────────────────
export const gradient = {
  primary: [palette.indigo[600], palette.indigo[400]] as readonly [string, string],
  secondary: [palette.cyan[500], palette.cyan[400]] as readonly [string, string],
  success: [palette.emerald[600], palette.emerald[400]] as readonly [string, string],
  danger: [palette.rose[600], palette.rose[400]] as readonly [string, string],
  mesh1: [canvas.base, '#1E1B4B'] as readonly [string, string],
  mesh2: [canvas.base, '#064E3B'] as readonly [string, string],
} as const;

// ─── Shadows ───────────────────────────────────────────────────────
export const shadow = {
  subtle: Platform.OS === 'web' ? { boxShadow: '0 2px 8px rgba(0,0,0,0.25)' } as any : {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 0,
  },
  low: Platform.OS === 'web' ? { boxShadow: '0 2px 8px rgba(0,0,0,0.25)' } as any : {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 0,
  },
  medium: Platform.OS === 'web' ? { boxShadow: '0 4px 16px rgba(0,0,0,0.35)' } as any : {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 0,
  },
  strong: Platform.OS === 'web' ? { boxShadow: '0 8px 24px rgba(0,0,0,0.45)' } as any : {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 0,
  },
  high: Platform.OS === 'web' ? { boxShadow: '0 8px 24px rgba(0,0,0,0.45)' } as any : {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 0,
  },
  glow: (color: string) => Platform.OS === 'web' ? { boxShadow: `0 0 16px ${color}` } as any : {
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 0,
  },
};

// ─── Heat Colors ───────────────────────────────────────────────────
export const heat = {
  limeHeat: palette.lime[500],
  orangeHeat: palette.orange[500],
  yellowHeat: palette.yellow[500],
} as const;

