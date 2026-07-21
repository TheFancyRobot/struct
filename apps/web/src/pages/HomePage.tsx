/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import type { Component } from 'solid-js'
import {
  MixedSourceReport,
  mixedSourceDemoFixture,
} from '../components/MixedSourceReport'

export const HomePage: Component = () => (
  <section
    aria-labelledby="document-research-title"
    class="research-page space-y-5"
  >
    <header class="research-title-block px-1 py-2 sm:py-3">
      <p class="text-sm font-semibold text-primary">Research workbench</p>
      <h1 id="document-research-title" class="mt-1 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Grounded analysis</h1>
      <p class="mt-1 text-base text-base-content/65">Renewal risk synthesis</p>
    </header>
    <MixedSourceReport report={mixedSourceDemoFixture('complete')} />
  </section>
)
