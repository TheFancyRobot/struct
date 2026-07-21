import { publicBasePathFromEnv, stripBasePath } from '../base-path'

export function reportReturnPath(
  projectId: string,
  value: string | undefined,
): string | undefined {
  if (value === undefined) return undefined

  const url = new URL(value, 'https://struct.local')
  if (url.origin !== 'https://struct.local') return undefined

  const pathname = stripBasePath(url.pathname, publicBasePathFromEnv(import.meta.env))
  if (pathname === null) return undefined

  const normalized = `${pathname}${url.search}`
  const notebook = `/projects/${projectId}/notebook`
  return normalized === notebook || normalized.startsWith(`${notebook}?`)
    ? normalized
    : undefined
}
