import { mock } from 'bun:test'

// SSR test harness router mock.
//
// The prebuilt @solidjs/router entry calls solid-js/web's client-only
// `template` primitive at module load, which throws under the server build
// used by renderToString (see BUG-0062). Any SSR test that renders a
// router-using component must stub the router.
//
// bun's `mock.module` is process-global and the first-loaded mock wins, so two
// test files that each register their own router mock collide. This helper
// registers a single shared mock with a mutable params store so every
// router-using SSR test shares one stub. Call `setRouterParams` to drive
// `useParams`/`useSearchParams` for a given test.

let params: Record<string, string | undefined> = {}

/** Replace the shared route params returned by `useParams`/`useSearchParams`. */
export function setRouterParams(next: Record<string, string | undefined>): void {
  params = next
}

mock.module('@solidjs/router', () => ({
  A: (props: { readonly children?: unknown }) => props.children,
  useParams: () => params,
  useSearchParams: () => [params, () => {}],
  useLocation: () => ({
    pathname: '/',
    search: '',
    hash: '',
    query: {},
    route: undefined,
  }),
  useNavigate: () => () => {},
}))
