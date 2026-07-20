import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import postgres from 'postgres'

const databaseUrl = process.env['DATABASE_URL']
const run = databaseUrl === undefined ? describe.skip : describe
const token = 'integration-auth-boundary-token'
const workspaceId = '920e8400-e29b-41d4-a716-446655440000'
const foreignWorkspaceId = '920e8400-e29b-41d4-a716-446655440001'
const projectId = '920e8400-e29b-41d4-a716-446655440010'
const foreignProjectId = '920e8400-e29b-41d4-a716-446655440011'
const root = mkdtempSync(`${tmpdir()}/struct-api-auth-integration-`)
const sql = databaseUrl === undefined ? undefined : postgres(databaseUrl)
let origin = ''
let child: ReturnType<typeof Bun.spawn> | undefined

const availablePort = (): Promise<number> => new Promise((resolvePort, reject) => {
  const server = createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const address = server.address()
    if (!address || typeof address === 'string') {
      server.close()
      reject(new Error('Could not allocate auth integration port'))
      return
    }
    server.close((error) => error ? reject(error) : resolvePort(address.port))
  })
})

run('API workspace isolation boundary', () => {
  beforeAll(async () => {
    await sql!.unsafe('DELETE FROM projects WHERE id = ANY($1::uuid[])', [[
      projectId,
      foreignProjectId,
    ]])
    await sql!.unsafe('DELETE FROM workspaces WHERE id = ANY($1::uuid[])', [[
      workspaceId,
      foreignWorkspaceId,
    ]])
    await sql!.unsafe('INSERT INTO workspaces (id, name) VALUES ($1, $2), ($3, $4)', [
      workspaceId,
      'Auth boundary owner',
      foreignWorkspaceId,
      'Auth boundary foreign',
    ])
    await sql!.unsafe(
      'INSERT INTO projects (id, workspace_id, name) VALUES ($1, $2, $3), ($4, $5, $6)',
      [projectId, workspaceId, 'Owned', foreignProjectId, foreignWorkspaceId, 'Foreign'],
    )
    const port = await availablePort()
    origin = `http://127.0.0.1:${port}`
    child = Bun.spawn(['bun', resolve(import.meta.dirname, 'main.ts')], {
      env: {
        ...process.env,
        API_PORT: String(port),
        API_AUTH_TOKEN: token,
        API_WORKSPACE_ID: workspaceId,
        DATABASE_URL: databaseUrl!,
        ARTIFACT_STORAGE_ROOT: root,
      },
      stdout: 'ignore',
      stderr: 'ignore',
    })
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        if ((await fetch(`${origin}/healthz`)).ok) return
      } catch {
        // Listener is still starting.
      }
      await Bun.sleep(50)
    }
    throw new Error('API auth integration server did not start')
  })

  afterAll(async () => {
    child?.kill()
    await sql!.unsafe('DELETE FROM projects WHERE id = ANY($1::uuid[])', [[
      projectId,
      foreignProjectId,
    ]])
    await sql!.unsafe('DELETE FROM workspaces WHERE id = ANY($1::uuid[])', [[
      workspaceId,
      foreignWorkspaceId,
    ]])
    await sql!.end()
    rmSync(root, { recursive: true, force: true })
  })

  it('returns the same non-existence response for foreign and guessed projects', async () => {
    for (const candidate of [
      foreignProjectId,
      '920e8400-e29b-41d4-a716-446655440099',
    ]) {
      const response = await fetch(`${origin}/api/projects/${candidate}/research`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: 'ResourceNotFound' })
    }
  })

  it('denies a foreign workspace in an otherwise owned project scope', async () => {
    const response = await fetch(
      `${origin}/api/projects/${projectId}/dataset-queries?workspaceId=${foreignWorkspaceId}`,
      { headers: { authorization: `Bearer ${token}` } },
    )
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'DatasetQueryNotFound' })
  })
})
