/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// BUG-0065 regression: the sidebar "Project" `.menu-title` section label must
// meet WCAG 2.1 AA contrast (>= 4.5:1) against the sidebar surface in BOTH
// themes. DaisyUI's default `.menu-title` renders base-content at 40% alpha
// (2.55:1 light / 3.32:1 dark), so the app overrides the color in index.css.
// This test resolves the override against the real brand tokens so a regression
// (removed override or a token that drops below AA) fails fast.

const indexCss = readFileSync(
  path.resolve(new URL('.', import.meta.url).pathname, './index.css'),
  'utf8',
)

interface Channel {
  r: number
  g: number
  b: number
}

function parseHex(hex: string): Channel {
  const value = hex.replace('#', '')
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  }
}

function luminance({ r, g, b }: Channel): number {
  const channel = (value: number) => {
    const normalized = value / 255
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(foreground: Channel, background: Channel): number {
  const lighter = Math.max(luminance(foreground), luminance(background))
  const darker = Math.min(luminance(foreground), luminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

// Extract a `:root { ... }` or `[data-theme="struct-dark"] { ... }` block.
function themeBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = indexCss.match(new RegExp(`${escaped}\\s*{([\\s\\S]*?)\\n}`))
  if (!match) throw new Error(`Theme block not found for selector: ${selector}`)
  return match[1]!
}

function token(block: string, name: string): string {
  const match = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8});`))
  if (!match) throw new Error(`Token --${name} not found in block`)
  return match[1]!
}

// Find the app's `.menu-title { ... }` override in index.css and resolve its
// `color` declaration through var() references to a hex token per theme.
function menuTitleColor(block: string): string {
  const rule = indexCss.match(/\.app-shell\s+\.menu-title\s*{[^}]*}/)
  if (!rule) throw new Error('No app-shell .menu-title override in index.css')
  const color = rule[0]!.match(/color:\s*([^;]+);/)
  if (!color) throw new Error('.menu-title override has no color declaration')
  const value = color[1]!.trim()
  const varRef = value.match(/var\(--([a-z0-9-]+)\)/i)
  if (varRef) return token(block, varRef[1]!)
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return value
  throw new Error(`Unsupported .menu-title color value: ${value}`)
}

describe('BUG-0065 menu-title contrast', () => {
  const light = themeBlock(':root')
  const dark = themeBlock('[data-theme="struct-dark"]')

  it('meets WCAG AA 4.5:1 against the sidebar surface in light mode', () => {
    const foreground = parseHex(menuTitleColor(light))
    const background = parseHex(token(light, 'struct-surface'))
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5)
  })

  it('meets WCAG AA 4.5:1 against the sidebar surface in dark mode', () => {
    const foreground = parseHex(menuTitleColor(dark))
    const background = parseHex(token(dark, 'struct-surface'))
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5)
  })
})
