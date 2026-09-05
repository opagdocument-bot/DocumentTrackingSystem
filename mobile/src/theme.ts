import { Platform } from 'react-native'

/**
 * The SUBAYBAY UI Design canvas language, on the phone: cool blue/white/ink,
 * rounded controls, system text standing in for Baloo 2 + Inter (a webfont
 * pair isn't worth a new native dependency on a device that already had
 * SDK-version and connectivity trouble this session).
 *
 * `S` is the only source of distance in this app. Anything that needs a gap,
 * a padding or a margin takes it from here, so the space between any two
 * things is the same space used everywhere else.
 */
export const S = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
  8: 40,
} as const

export const R = {
  xs: 8,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
} as const

/**
 * The design canvas uses Baloo 2 for headings and Inter for the interface.
 * Native sans and mono stand in for them here rather than pulling in a font
 * package — see the module note above.
 */
export const FONT = Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' })!
export const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })!

export const T = {
  desk: '#F4F6FB',
  brand: '#4F6EF7',
  brand2: '#4457C9',
  frame: '#ECEFF8',
  frame2: '#ECEFF8',
  panel: '#FFFFFF',
  sub: '#F1F3FA',
  sub2: '#E4E8F3',
  line: '#DFE3F0',
  line2: '#D2D7EA',

  ink: '#171923',
  ink2: '#3A3D4D',
  muted: '#6B7290',
  muted2: '#9299B4',

  onFrame: '#171923',
  onFrameDim: '#6B7290',

  accent: '#4F6EF7',
  accentSoft: '#E9EDFF',
  accentLine: '#AEBBFF',

  lime: '#E6F8EC',

  ok: '#2C8C50', okSoft: '#E6F8EC', okLine: '#9FE0B6',
  warn: '#92660D', warnSoft: '#FBF3E0', warnLine: '#E8D6A8',
  crit: '#B0392C', critSoft: '#FBEEEC', critLine: '#EDCEC8',
  info: '#4F6EF7', infoSoft: '#E9EDFF', infoLine: '#AEBBFF',
  neutral: '#3A3D4D', neutralSoft: '#E4E8F3', neutralLine: '#D2D7EA',
} as const

export type Tone = 'neutral' | 'ok' | 'warn' | 'crit' | 'info' | 'accent'

export const toneColors: Record<Tone, { fg: string; bg: string; border: string }> = {
  neutral: { fg: T.neutral, bg: T.neutralSoft, border: T.neutralLine },
  ok: { fg: T.ok, bg: T.okSoft, border: T.okLine },
  warn: { fg: T.warn, bg: T.warnSoft, border: T.warnLine },
  crit: { fg: T.crit, bg: T.critSoft, border: T.critLine },
  info: { fg: T.info, bg: T.infoSoft, border: T.infoLine },
  accent: { fg: T.accent, bg: T.accentSoft, border: T.accentLine },
}

/** Every piece of text in the app starts from one of these. */
export const type = {
  h1: { fontFamily: FONT, fontSize: 25, fontWeight: '600' as const, color: T.ink, letterSpacing: -0.3 },
  h2: { fontFamily: FONT, fontSize: 17, fontWeight: '600' as const, color: T.ink },
  h3: { fontFamily: FONT, fontSize: 15, fontWeight: '600' as const, color: T.ink },
  body: { fontFamily: FONT, fontSize: 14.5, color: T.ink, lineHeight: 21 },
  sub: { fontFamily: FONT, fontSize: 13, color: T.muted, lineHeight: 19 },
  small: { fontFamily: FONT, fontSize: 11.5, color: T.muted },
  label: {
    fontFamily: FONT, fontSize: 10.5, letterSpacing: 0.7, textTransform: 'uppercase' as const,
    color: T.muted, fontWeight: '700' as const,
  },
  mono: { fontFamily: MONO, fontSize: 13, color: T.ink, letterSpacing: 0.2 },
}
