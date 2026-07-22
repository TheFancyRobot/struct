import path from 'node:path'
import { basePathFromEnv, stripBasePath } from './base-path'

const DEFAULT_API_ORIGIN = 'http://127.0.0.1:3001'
const DEFAULT_WEB_PORT = 3000

export interface WebServerConfig {
  readonly apiOrigin: URL
  readonly apiAuthToken: string
  readonly basePath: string
  readonly distRoot: string
  readonly port: number
}

export function loadWebServerConfig(
  environment: Readonly<Record<string, string | undefined>>,
  currentDirectory = process.cwd(),
): WebServerConfig {
  const apiAuthToken = environment['API_AUTH_TOKEN']
  if (apiAuthToken === undefined || apiAuthToken.length < 16) {
    throw new Error('API_AUTH_TOKEN must contain at least 16 characters')
  }
  const apiOrigin = new URL(environment['API_ORIGIN'] ?? DEFAULT_API_ORIGIN)
  if (!['http:', 'https:'].includes(apiOrigin.protocol)) {
    throw new Error('API_ORIGIN must use http or https')
  }
  const port = Number(environment['WEB_PORT'] ?? DEFAULT_WEB_PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('WEB_PORT must be a valid TCP port')
  }
  return {
    apiOrigin,
    apiAuthToken,
    basePath: basePathFromEnv(environment),
    distRoot: path.resolve(currentDirectory, environment['DIST_ROOT'] ?? 'dist'),
    port,
  }
}

export async function proxyApiRequest(
  request: Request,
  config: Pick<WebServerConfig, 'apiOrigin' | 'apiAuthToken'>,
): Promise<Response> {
  const incoming = new URL(request.url)
  const upstream = new URL(`${incoming.pathname}${incoming.search}`, config.apiOrigin)
  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.set('authorization', `Bearer ${config.apiAuthToken}`)
  return fetch(upstream, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'manual',
  })
}

function safeAssetPath(pathname: string): string | undefined {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return undefined
  }
  const normalized = path.posix.normalize(decoded)
  if (normalized.includes('\0') || normalized.startsWith('/../')) {
    return undefined
  }
  return normalized.slice(1)
}

export function createWebRequestHandler(
  config: WebServerConfig,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const url = new URL(request.url)
    if (config.basePath !== '' && (url.pathname === '' || url.pathname === '/')) {
      return Response.redirect(new URL(`${config.basePath}/`, url.origin), 302)
    }
    const pathname = stripBasePath(url.pathname, config.basePath)
    if (pathname === null) return new Response('Not Found', { status: 404 })
    if (pathname.startsWith('/api/')) {
      return proxyApiRequest(new Request(new URL(`${pathname}${url.search}`, url.origin), request), config)
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Method Not Allowed', { status: 405 })
    }
    const relativePath = safeAssetPath(pathname)
    if (relativePath === undefined) return new Response('Not Found', { status: 404 })
    const asset = Bun.file(path.join(config.distRoot, relativePath || 'index.html'))
    if (await asset.exists()) return new Response(request.method === 'HEAD' ? null : asset)
    if (path.extname(relativePath) !== '') {
      return new Response('Not Found', { status: 404 })
    }
    const index = Bun.file(path.join(config.distRoot, 'index.html'))
    return (await index.exists())
      ? new Response(request.method === 'HEAD' ? null : index)
      : new Response('Web build not found', { status: 503 })
  }
}

if (import.meta.main) {
  const config = loadWebServerConfig(process.env)
  Bun.serve({
    port: config.port,
    fetch: createWebRequestHandler(config),
  })
}
