import { afterAll, describe, expect, it } from 'bun:test'
import {
  ExportBundleDigest,
  ProjectId,
  ReportId,
  WorkspaceId,
} from '@struct/domain'
import { makeReportFidelityExportFixture } from '@struct/evaluation'
import {
  LocalArtifactStore,
  prepareReportExport,
  publishReportExport,
  readVerifiedReportExport,
} from '@struct/source-storage'
import { Effect } from 'effect'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { reportExportRoute } from '../src/routes/report-export.js'

const roots: string[] = []

afterAll(async () => {
  await Promise.all(roots.splice(0).map((root) =>
    rm(root, { recursive: true, force: true })))
})

describe('report export API integration', () => {
  it('round-trips the exact report revision through storage and restart', async () => {
    const fixture = await Effect.runPromise(makeReportFidelityExportFixture())
    const root = await mkdtemp(join(tmpdir(), 'struct-report-audit-'))
    roots.push(root)
    const store = await Effect.runPromise(LocalArtifactStore.make({ root }))

    const deps = {
      producerVersion: '1.0.0',
      authorize: (
        credential: string,
        workspaceId: typeof WorkspaceId.Type,
        projectId: typeof ProjectId.Type,
      ) => credential === 'report-auditor'
          && workspaceId === fixture.report.workspaceId
          && projectId === fixture.report.projectId
        ? Effect.void
        : Effect.fail({ _tag: 'AuthorizationError' as const }),
      findReportRevision: (
        workspaceId: typeof WorkspaceId.Type,
        projectId: typeof ProjectId.Type,
        reportId: typeof ReportId.Type,
        reportRevision: number,
      ) => workspaceId === fixture.report.workspaceId
          && projectId === fixture.report.projectId
          && reportId === fixture.report.id
          && reportRevision === fixture.report.revision
        ? Effect.succeed(fixture.report)
        : Effect.fail({ _tag: 'ReportScopeError' as const }),
      findProvenance: () => Effect.succeed(fixture.graph),
      authorizeSources: () => Effect.void,
      prepare: (report: typeof fixture.report, provenance: typeof fixture.graph) =>
        prepareReportExport({
          report,
          provenance,
          producerVersion: '1.0.0',
        }),
      publish: (report: typeof fixture.report, provenance: typeof fixture.graph) =>
        publishReportExport(store, {
          report,
          provenance,
          producerVersion: '1.0.0',
        }).pipe(Effect.map((published) => published.status)),
      read: (digest: typeof ExportBundleDigest.Type) =>
        readVerifiedReportExport(store, digest).pipe(
          Effect.map(({ stored }) => stored),
        ),
    }
    const key =
      `export:${fixture.report.id}:${fixture.report.revision}:1.0.0`
    const start = await Effect.runPromise(reportExportRoute(
      new Request(
        `http://local/api/projects/${fixture.report.projectId}/reports/${fixture.report.id}/exports`,
        {
          method: 'POST',
          headers: {
            authorization: 'Bearer report-auditor',
            'content-type': 'application/json',
            'idempotency-key': key,
          },
          body: JSON.stringify({
            workspaceId: fixture.report.workspaceId,
            reportRevision: fixture.report.revision,
          }),
        },
      ),
      deps,
    ))
    expect(start?.status).toBe(201)
    const status = await start!.json()

    const reopenedStore = await Effect.runPromise(
      LocalArtifactStore.make({ root }),
    )
    const restartedDeps = {
      ...deps,
      read: (digest: typeof ExportBundleDigest.Type) =>
        readVerifiedReportExport(reopenedStore, digest).pipe(
          Effect.map(({ stored }) => stored),
        ),
    }
    const base =
      `http://local/api/projects/${fixture.report.projectId}/reports/${fixture.report.id}/exports/${status.digest}?workspaceId=${fixture.report.workspaceId}&reportRevision=${fixture.report.revision}`
    const metadata = await Effect.runPromise(reportExportRoute(
      new Request(base, {
        headers: { authorization: 'Bearer report-auditor' },
      }),
      restartedDeps,
    ))
    const download = await Effect.runPromise(reportExportRoute(
      new Request(`${base}&download=1`, {
        headers: { authorization: 'Bearer report-auditor' },
      }),
      restartedDeps,
    ))
    expect(metadata?.status).toBe(200)
    expect(await metadata?.json()).toMatchObject({
      digest: status.digest,
      reportRevision: fixture.report.revision,
    })
    expect(download?.status).toBe(200)
    expect(download?.headers.get('x-content-type-options')).toBe('nosniff')
    expect(new Uint8Array(await download!.arrayBuffer()).byteLength)
      .toBe(status.byteLength)

    const denied = await Effect.runPromise(reportExportRoute(
      new Request(base, {
        headers: { authorization: 'Bearer wrong-workspace' },
      }),
      restartedDeps,
    ))
    expect(denied?.status).toBe(404)
    expect(await denied?.json()).toEqual({ error: 'ReportExportNotFound' })
  })
})
