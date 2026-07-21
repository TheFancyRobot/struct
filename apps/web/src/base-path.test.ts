import { describe, expect, it } from 'bun:test'
import {
  apiPath,
  basePathFromPublicBaseUrl,
  normalizeBasePath,
  stripBasePath,
  withBasePath,
} from './base-path'

describe('web base path helpers', () => {
  it('normalizes empty and rooted values', () => {
    expect(normalizeBasePath(undefined)).toBe('')
    expect(normalizeBasePath('')).toBe('')
    expect(normalizeBasePath('/')).toBe('')
    expect(normalizeBasePath('struct')).toBe('/struct')
    expect(normalizeBasePath('/struct/')).toBe('/struct')
  })

  it('derives a path prefix from Vite base URLs', () => {
    expect(basePathFromPublicBaseUrl('/')).toBe('')
    expect(basePathFromPublicBaseUrl('/struct/')).toBe('/struct')
    expect(basePathFromPublicBaseUrl('https://example.com/struct/')).toBe('/struct')
  })

  it('joins application and api paths against the configured base', () => {
    expect(withBasePath('/', '')).toBe('/')
    expect(withBasePath('/projects/demo', '/struct')).toBe('/struct/projects/demo')
    expect(apiPath('/projects/demo', '')).toBe('/api/projects/demo')
    expect(apiPath('/projects/demo', '/struct')).toBe('/struct/api/projects/demo')
  })

  it('strips the configured base path for server-side request handling', () => {
    expect(stripBasePath('/projects/demo', '')).toBe('/projects/demo')
    expect(stripBasePath('/struct', '/struct')).toBe('/')
    expect(stripBasePath('/struct/projects/demo', '/struct')).toBe('/projects/demo')
    expect(stripBasePath('/other/projects/demo', '/struct')).toBeNull()
  })
})
