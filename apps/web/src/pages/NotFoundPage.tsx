import { basePathFromPublicBaseUrl, withBasePath } from '../base-path'

const appBasePath = basePathFromPublicBaseUrl(import.meta.env.BASE_URL)

/** Accessible recovery surface for workspace paths that do not match a route. */
export function NotFoundPage() {
  return (
    <section class="flex min-h-48 flex-col items-start justify-center gap-4 rounded-box border border-base-300 bg-base-100 p-6" aria-labelledby="not-found-heading">
      <p class="text-sm font-medium text-base-content/65">404</p>
      <div class="space-y-2">
        <h1 id="not-found-heading" class="text-2xl font-semibold">Page not found</h1>
        <p class="text-base-content/75">This workspace page does not exist or may have moved.</p>
      </div>
      <nav class="flex flex-wrap gap-2" aria-label="Not found recovery">
        <a class="btn btn-primary btn-sm" href={withBasePath('/', appBasePath)}>Back to projects</a>
        <a class="btn btn-ghost btn-sm" href={withBasePath('/sources', appBasePath)}>Browse sources</a>
      </nav>
    </section>
  )
}
