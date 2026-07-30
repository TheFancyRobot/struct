/** @jsxImportSource solid-js */
import { mock } from 'bun:test'
import type { Component, JSX } from 'solid-js'

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

const MockLink: Component<{
  readonly children?: JSX.Element
  readonly class?: string
  readonly href?: string
}> = (props) => (
  <a class={props.class} href={props.href}>{props.children}</a>
)

mock.module('@solidjs/router', () => ({
  A: MockLink,
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
