export function apiProxyHeaders(
  token: string | undefined,
): Readonly<Record<string, string>> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function appBase(basePath: string): string {
  return basePath === '' ? '/' : `${basePath}/`
}
