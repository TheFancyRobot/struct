/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { type Component, type ComponentProps } from 'solid-js'

/**
 * Inline SVG SolidJS components for the Struct brand assets, transcribed from
 * `.brand/assets/svg/` (reference-only, not imported at runtime).
 *
 * Each exported component maps 1:1 to one asset file. The on-light/on-dark
 * variants keep their fixed signature palette — these are brand-mark geometry,
 * not product tokens, so the raw hex is intentional and matches `.brand/`.
 * The `CssVariables` icon and `CurrentColor` wordmark are the theme-adaptive
 * variants: they resolve to `--struct-logo-*` and `currentColor` so a single
 * lockup auto-switches with the `data-theme` attribute (no conditional render).
 */

type SymbolColors = {
  readonly neutral: string
  readonly blue: string
  readonly sky: string
  readonly violet: string
  readonly warm: string
}

// Struct signature logo palette — copied from .brand/assets/svg/ (on-light).
const LIGHT_COLORS: SymbolColors = {
  neutral: '#E2E8F0',
  blue: '#2563EB',
  sky: '#38BDF8',
  violet: '#8B5CF6',
  warm: '#F97316',
}

// Struct signature logo palette — copied from .brand/assets/svg/ (on-dark).
const DARK_COLORS: SymbolColors = {
  neutral: '#334155',
  blue: '#60A5FA',
  sky: '#38BDF8',
  violet: '#A78BFA',
  warm: '#FBBF24',
}

// Theme-adaptive palette: resolves to --struct-logo-* (defined per data-theme
// in apps/web/src/index.css), so the icon switches with the active theme.
const LOGO_VAR_COLORS: SymbolColors = {
  neutral: 'var(--struct-logo-neutral)',
  blue: 'var(--struct-logo-blue)',
  sky: 'var(--struct-logo-sky)',
  violet: 'var(--struct-logo-violet)',
  warm: 'var(--struct-logo-warm)',
}

// The 12-cell modular symbol. Cell positions and the position→role mapping
// are fixed by the brand; only the five colors vary between assets.
const SymbolCells: Component<{ colors: SymbolColors }> = (props) => (
  <>
    <rect x="6" y="12" width="24" height="18" rx="4" fill={props.colors.neutral} />
    <rect x="36" y="12" width="24" height="18" rx="4" fill={props.colors.blue} />
    <rect x="66" y="12" width="24" height="18" rx="4" fill={props.colors.sky} />
    <rect x="6" y="38" width="24" height="18" rx="4" fill={props.colors.neutral} />
    <rect x="36" y="38" width="24" height="18" rx="4" fill={props.colors.violet} />
    <rect x="66" y="38" width="24" height="18" rx="4" fill={props.colors.neutral} />
    <rect x="6" y="64" width="24" height="18" rx="4" fill={props.colors.neutral} />
    <rect x="36" y="64" width="24" height="18" rx="4" fill={props.colors.neutral} />
    <rect x="66" y="64" width="24" height="18" rx="4" fill={props.colors.violet} />
    <rect x="6" y="90" width="24" height="18" rx="4" fill={props.colors.warm} />
    <rect x="36" y="90" width="24" height="18" rx="4" fill={props.colors.warm} />
    <rect x="66" y="90" width="24" height="18" rx="4" fill={props.colors.neutral} />
  </>
)

// The custom lowercase "struct" wordmark as 8 vector paths. Stroke color and
// transform are set on the parent <g> by each wordmark/lockup component.
const WordmarkPaths: Component = () => (
  <>
    <path d="M56 30 H32 C28.5 30 27 32 27 35.5 V39 C27 42 29 44 32 44 H51 C54.5 44 56 46 56 49 V51.5 C56 54.5 54 56 51 56 H27" />
    <path d="M103.5 18 V50.5 C103.5 54 105.5 55.5 109 55.5 H123" />
    <path d="M91 30 H124" />
    <path d="M159 55 V35 C159 31.5 161.5 29.5 165 29.5 H184 C187.5 29.5 189 31.5 189 35 V41.5" />
    <path d="M226 30 V50 C226 53.5 228 55.5 231.5 55.5 H250.5 C254 55.5 256 53.5 256 50 V30" />
    <path d="M326 30 H302.5 C299 30 297 32 297 35.5 V50 C297 53.5 299 55.5 302.5 55.5 H326" />
    <path d="M375.5 18 V50.5 C375.5 54 377.5 55.5 381 55.5 H395" />
    <path d="M363 30 H396" />
  </>
)

// `struct-icon-color-on-light.svg`
export const StructIconColorOnLight: Component<ComponentProps<'svg'>> = (props) => (
  <svg viewBox="0 0 96 120" xmlns="http://www.w3.org/2000/svg" role="img" {...props}>
    <title>Struct color icon</title>
    <g><SymbolCells colors={LIGHT_COLORS} /></g>
  </svg>
)

// `struct-icon-color-on-dark.svg`
export const StructIconColorOnDark: Component<ComponentProps<'svg'>> = (props) => (
  <svg viewBox="0 0 96 120" xmlns="http://www.w3.org/2000/svg" role="img" {...props}>
    <title>Struct color icon for dark backgrounds</title>
    <g><SymbolCells colors={DARK_COLORS} /></g>
  </svg>
)

// `struct-icon-css-variables.svg` — signature colors overridable via --struct-logo-*.
export const StructIconCssVariables: Component<ComponentProps<'svg'>> = (props) => (
  <svg viewBox="0 0 96 120" xmlns="http://www.w3.org/2000/svg" role="img" {...props}>
    <title>Struct configurable icon</title>
    <g><SymbolCells colors={LOGO_VAR_COLORS} /></g>
  </svg>
)

// `struct-icon-monochrome.svg` — currentColor + opacity pattern; inherits the
// parent text color so it adapts to the active theme.
export const StructIconMonochrome: Component<ComponentProps<'svg'>> = (props) => (
  <svg viewBox="0 0 96 120" xmlns="http://www.w3.org/2000/svg" role="img" {...props}>
    <title>Struct monochrome icon</title>
    <g>
      <rect x="6" y="12" width="24" height="18" rx="4" fill="currentColor" opacity="0.22" />
      <rect x="36" y="12" width="24" height="18" rx="4" fill="currentColor" opacity="1" />
      <rect x="66" y="12" width="24" height="18" rx="4" fill="currentColor" opacity="1" />
      <rect x="6" y="38" width="24" height="18" rx="4" fill="currentColor" opacity="0.22" />
      <rect x="36" y="38" width="24" height="18" rx="4" fill="currentColor" opacity="1" />
      <rect x="66" y="38" width="24" height="18" rx="4" fill="currentColor" opacity="0.22" />
      <rect x="6" y="64" width="24" height="18" rx="4" fill="currentColor" opacity="0.22" />
      <rect x="36" y="64" width="24" height="18" rx="4" fill="currentColor" opacity="0.22" />
      <rect x="66" y="64" width="24" height="18" rx="4" fill="currentColor" opacity="1" />
      <rect x="6" y="90" width="24" height="18" rx="4" fill="currentColor" opacity="1" />
      <rect x="36" y="90" width="24" height="18" rx="4" fill="currentColor" opacity="1" />
      <rect x="66" y="90" width="24" height="18" rx="4" fill="currentColor" opacity="0.22" />
    </g>
  </svg>
)

// `struct-favicon.svg` — also shipped as a static file in apps/web/public/.
export const StructFavicon: Component<ComponentProps<'svg'>> = (props) => (
  <svg viewBox="0 0 96 120" xmlns="http://www.w3.org/2000/svg" role="img" {...props}>
    <title>Struct favicon</title>
    <g><SymbolCells colors={LIGHT_COLORS} /></g>
  </svg>
)

// `struct-app-icon-light.svg`
export const StructAppIconLight: Component<ComponentProps<'svg'>> = (props) => (
  <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" role="img" {...props}>
    <title>Struct app icon light</title>
    <rect x="8" y="8" width="496" height="496" rx="112" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="16" />
    <g transform="translate(160 76) scale(2)"><SymbolCells colors={LIGHT_COLORS} /></g>
  </svg>
)

// `struct-app-icon-dark.svg`
export const StructAppIconDark: Component<ComponentProps<'svg'>> = (props) => (
  <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" role="img" {...props}>
    <title>Struct app icon dark</title>
    <rect x="8" y="8" width="496" height="496" rx="112" fill="#0F172A" stroke="#334155" stroke-width="16" />
    <g transform="translate(160 76) scale(2)"><SymbolCells colors={DARK_COLORS} /></g>
  </svg>
)

// `struct-wordmark-on-light.svg`
export const StructWordmarkOnLight: Component<ComponentProps<'svg'>> = (props) => (
  <svg viewBox="0 0 421 78" xmlns="http://www.w3.org/2000/svg" role="img" {...props}>
    <title>Struct wordmark for light backgrounds</title>
    <g fill="none" stroke="#0F172A" stroke-width="6.5" stroke-linecap="square" stroke-linejoin="round">
      <WordmarkPaths />
    </g>
  </svg>
)

// `struct-wordmark-on-dark.svg`
export const StructWordmarkOnDark: Component<ComponentProps<'svg'>> = (props) => (
  <svg viewBox="0 0 421 78" xmlns="http://www.w3.org/2000/svg" role="img" {...props}>
    <title>Struct wordmark for dark backgrounds</title>
    <g fill="none" stroke="#E2E8F0" stroke-width="6.5" stroke-linecap="square" stroke-linejoin="round">
      <WordmarkPaths />
    </g>
  </svg>
)

// `struct-wordmark-currentcolor.svg` — set color on the SVG or its parent.
export const StructWordmarkCurrentColor: Component<ComponentProps<'svg'>> = (props) => (
  <svg viewBox="0 0 421 78" xmlns="http://www.w3.org/2000/svg" role="img" {...props}>
    <title>Struct wordmark</title>
    <g fill="none" stroke="currentColor" stroke-width="6.5" stroke-linecap="square" stroke-linejoin="round">
      <WordmarkPaths />
    </g>
  </svg>
)

// `struct-lockup-compact-on-light.svg`
export const StructLockupCompactOnLight: Component<ComponentProps<'svg'>> = (props) => (
  <svg viewBox="0 0 380 100" xmlns="http://www.w3.org/2000/svg" role="img" {...props}>
    <title>Struct compact logo for light backgrounds</title>
    <g transform="translate(4 9) scale(0.67)"><SymbolCells colors={LIGHT_COLORS} /></g>
    <g transform="translate(80 24) scale(0.67)" fill="none" stroke="#0F172A" stroke-width="6.5" stroke-linecap="square" stroke-linejoin="round">
      <WordmarkPaths />
    </g>
  </svg>
)

// `struct-lockup-compact-on-dark.svg`
export const StructLockupCompactOnDark: Component<ComponentProps<'svg'>> = (props) => (
  <svg viewBox="0 0 380 100" xmlns="http://www.w3.org/2000/svg" role="img" {...props}>
    <title>Struct compact logo for dark backgrounds</title>
    <g transform="translate(4 9) scale(0.67)"><SymbolCells colors={DARK_COLORS} /></g>
    <g transform="translate(80 24) scale(0.67)" fill="none" stroke="#E2E8F0" stroke-width="6.5" stroke-linecap="square" stroke-linejoin="round">
      <WordmarkPaths />
    </g>
  </svg>
)

// `struct-lockup-horizontal-on-light.svg`
export const StructLockupHorizontalOnLight: Component<ComponentProps<'svg'>> = (props) => (
  <svg viewBox="0 0 530 120" xmlns="http://www.w3.org/2000/svg" role="img" {...props}>
    <title>Struct horizontal logo for light backgrounds</title>
    <g transform="translate(8 0) scale(0.92)"><SymbolCells colors={LIGHT_COLORS} /></g>
    <path d="M118 22V98" stroke="#CBD5E1" stroke-width="2" />
    <g transform="translate(130 20) scale(0.9)" fill="none" stroke="#0F172A" stroke-width="6.5" stroke-linecap="square" stroke-linejoin="round">
      <WordmarkPaths />
    </g>
  </svg>
)

// `struct-lockup-horizontal-on-dark.svg`
export const StructLockupHorizontalOnDark: Component<ComponentProps<'svg'>> = (props) => (
  <svg viewBox="0 0 530 120" xmlns="http://www.w3.org/2000/svg" role="img" {...props}>
    <title>Struct horizontal logo for dark backgrounds</title>
    <g transform="translate(8 0) scale(0.92)"><SymbolCells colors={DARK_COLORS} /></g>
    <path d="M118 22V98" stroke="#475569" stroke-width="2" />
    <g transform="translate(130 20) scale(0.9)" fill="none" stroke="#E2E8F0" stroke-width="6.5" stroke-linecap="square" stroke-linejoin="round">
      <WordmarkPaths />
    </g>
  </svg>
)

// `struct-lockup-stacked-on-light.svg`
export const StructLockupStackedOnLight: Component<ComponentProps<'svg'>> = (props) => (
  <svg viewBox="0 0 480 236" xmlns="http://www.w3.org/2000/svg" role="img" {...props}>
    <title>Struct stacked logo for light backgrounds</title>
    <g transform="translate(192 8)"><SymbolCells colors={LIGHT_COLORS} /></g>
    <g transform="translate(29 148)" fill="none" stroke="#0F172A" stroke-width="6.5" stroke-linecap="square" stroke-linejoin="round">
      <WordmarkPaths />
    </g>
  </svg>
)

// `struct-lockup-stacked-on-dark.svg`
export const StructLockupStackedOnDark: Component<ComponentProps<'svg'>> = (props) => (
  <svg viewBox="0 0 480 236" xmlns="http://www.w3.org/2000/svg" role="img" {...props}>
    <title>Struct stacked logo for dark backgrounds</title>
    <g transform="translate(192 8)"><SymbolCells colors={DARK_COLORS} /></g>
    <g transform="translate(29 148)" fill="none" stroke="#E2E8F0" stroke-width="6.5" stroke-linecap="square" stroke-linejoin="round">
      <WordmarkPaths />
    </g>
  </svg>
)

// `struct-grid-pattern-light.svg` — unique pattern id avoids collisions when
// both light/dark patterns could render on the same page.
export const StructGridPatternLight: Component<ComponentProps<'svg'>> = (props) => (
  <svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" {...props}>
    <title>Struct grid pattern light</title>
    <defs>
      <pattern id="struct-grid-pattern-light" width="48" height="48" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="4" r="1.5" fill="#CBD5E1" opacity="0.65" />
        <path d="M4 24H44M24 4V44" stroke="#E2E8F0" stroke-width="1" opacity="0.55" />
      </pattern>
    </defs>
    <rect width="240" height="240" fill="url(#struct-grid-pattern-light)" />
    <rect x="96" y="96" width="12" height="12" rx="3" fill="#2563EB" opacity="0.9" />
    <rect x="144" y="48" width="12" height="12" rx="3" fill="#14B8A6" opacity="0.75" />
  </svg>
)

// `struct-grid-pattern-dark.svg`
export const StructGridPatternDark: Component<ComponentProps<'svg'>> = (props) => (
  <svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" {...props}>
    <title>Struct grid pattern dark</title>
    <defs>
      <pattern id="struct-grid-pattern-dark" width="48" height="48" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="4" r="1.5" fill="#334155" opacity="0.9" />
        <path d="M4 24H44M24 4V44" stroke="#1E293B" stroke-width="1" opacity="0.9" />
      </pattern>
    </defs>
    <rect width="240" height="240" fill="#020617" />
    <rect width="240" height="240" fill="url(#struct-grid-pattern-dark)" />
    <rect x="96" y="96" width="12" height="12" rx="3" fill="#60A5FA" opacity="0.9" />
    <rect x="144" y="48" width="12" height="12" rx="3" fill="#2DD4BF" opacity="0.8" />
  </svg>
)
