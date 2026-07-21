export function normalizeBasePath(input: string | undefined): string {
  if (input === undefined) return ''
  const trimmed = input.trim()
  if (trimmed === '' || trimmed === '/') return ''
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeadingSlash.replace(/\/+$/, '')
}

export function basePathFromPublicBaseUrl(baseUrl: string | undefined): string {
  if (baseUrl === undefined || baseUrl.trim() === '') return ''
  try {
    return normalizeBasePath(new URL(baseUrl, 'https://struct.local').pathname)
  } catch {
    return normalizeBasePath(baseUrl)
  }
}

export function basePathFromEnv(
  environment: Readonly<Record<string, string | undefined>>,
): string {
  return normalizeBasePath(environment['BASE_PATH'])
}

export function publicBasePathFromEnv(
  environment: Readonly<Record<string, string | undefined>>,
): string {
  return basePathFromPublicBaseUrl(environment['BASE_URL'])
}

export function withBasePath(pathname: string, basePath: string): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  return basePath === '' ? normalizedPath : `${basePath}${normalizedPath}`
}

export function apiPath(pathname: string, basePath: string): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  return withBasePath(`/api${normalizedPath}`, basePath)
}

export function stripBasePath(pathname: string, basePath: string): string | null {
  if (basePath === '') return pathname
  if (pathname === basePath) return '/'
  if (pathname === `${basePath}/`) return '/'
  if (!pathname.startsWith(`${basePath}/`)) return null
  return pathname.slice(basePath.length)
}
