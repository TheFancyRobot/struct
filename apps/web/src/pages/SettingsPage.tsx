/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { For, Show, createResource, createSignal, type Component } from 'solid-js'
import { assignInferenceModel, createInferenceModel, createInferenceProvider, deleteInferenceProvider, fetchInferenceSettings, setInferenceProviderEnabled, testInferenceProvider, type InferenceRole, updateInferenceProvider } from '../api/inference-settings'

const roles: ReadonlyArray<InferenceRole> = ['chat', 'embedding', 'vision']

export const SettingsPage: Component = () => {
  const [settings, { refetch }] = createResource(fetchInferenceSettings)
  const [message, setMessage] = createSignal<string>()
  const save = async (operation: () => Promise<unknown>) => {
    try { await operation(); setMessage('Saved.'); await refetch() } catch (error) { setMessage(error instanceof Error ? error.message : 'Settings could not be saved.') }
  }
  const submitProvider = (event: SubmitEvent) => {
    event.preventDefault(); const form = event.currentTarget as HTMLFormElement
    void save(() => createInferenceProvider({ type: new FormData(form).get('type')?.toString() ?? '', endpoint: new FormData(form).get('endpoint')?.toString() ?? '', credentialReference: new FormData(form).get('credentialReference')?.toString() ?? '' })).then(() => form.reset())
  }
  const submitModel = (event: SubmitEvent) => {
    event.preventDefault(); const form = event.currentTarget as HTMLFormElement; const data = new FormData(form)
    void save(() => createInferenceModel({ providerId: data.get('providerId')?.toString() ?? '', name: data.get('name')?.toString() ?? '', capabilities: roles.filter((role) => data.has(role)) })).then(() => form.reset())
  }
  const updateProvider = (event: SubmitEvent, id: string) => {
    event.preventDefault(); const data = new FormData(event.currentTarget as HTMLFormElement)
    const credentialReference = data.get('credentialReference')?.toString().trim()
    void save(() => updateInferenceProvider(id, { type: data.get('type')?.toString() ?? '', endpoint: data.get('endpoint')?.toString() ?? '', ...(credentialReference === '' ? {} : { credentialReference }) }))
  }
  const testProvider = async (id: string) => {
    try { setMessage((await testInferenceProvider(id)).message) } catch (error) { setMessage(error instanceof Error ? error.message : 'Connection test could not be started.') }
  }
  return <section class="mx-auto max-w-4xl space-y-8 px-4 pt-4 sm:px-6 sm:pt-6" aria-labelledby="settings-heading">
    <div><h1 id="settings-heading" class="text-lg font-semibold">Settings</h1><p class="mt-1 text-sm text-base-content/70">Provider connections and the models used by each capability.</p></div>
    <Show when={message()}>{(text) => <p class="alert" role="status">{text()}</p>}</Show>
    <section class="space-y-3 rounded-box border border-base-300 p-4" aria-labelledby="providers-heading">
      <h2 id="providers-heading" class="font-semibold">Provider connections</h2>
      <p class="text-sm text-base-content/70">Credential references are write-only and never shown again.</p>
      <form class="grid gap-3 sm:grid-cols-2" onSubmit={submitProvider}>
        <label class="form-control"><span class="label-text">Provider type</span><input class="input input-bordered" name="type" required placeholder="OpenAI" /></label>
        <label class="form-control"><span class="label-text">Endpoint (optional)</span><input class="input input-bordered" name="endpoint" type="url" placeholder="https://api.example.com" /></label>
        <label class="form-control sm:col-span-2"><span class="label-text">Credential reference</span><input class="input input-bordered" name="credentialReference" required autocomplete="off" placeholder="secret://team/openai" /></label>
        <button class="btn btn-primary w-fit" type="submit">Save provider</button>
      </form>
      <ul class="space-y-2"><For each={settings()?.providers ?? []}>{(provider) => <li class="rounded-box bg-base-200 px-3 py-2 text-sm">
        <div class="flex flex-wrap items-center gap-2"><span>{provider.type}{provider.endpoint === null ? '' : ` — ${provider.endpoint}`}</span><span class="text-base-content/60">{provider.enabled ? 'Configured' : 'Disabled'}</span>
          <button class="btn btn-ghost btn-xs" type="button" onClick={() => void testProvider(provider.id)}>Test</button>
          <button class="btn btn-ghost btn-xs" type="button" onClick={() => void save(() => setInferenceProviderEnabled(provider.id, !provider.enabled))}>{provider.enabled ? 'Disable' : 'Enable'}</button>
          <button class="btn btn-ghost btn-xs" type="button" onClick={() => void save(() => deleteInferenceProvider(provider.id))}>Delete</button>
        </div>
        <details class="mt-2"><summary class="cursor-pointer">Update</summary><form class="mt-2 grid gap-2 sm:grid-cols-2" onSubmit={(event) => updateProvider(event, provider.id)}>
          <input class="input input-bordered input-sm" name="type" required value={provider.type} aria-label="Provider type" />
          <input class="input input-bordered input-sm" name="endpoint" type="url" value={provider.endpoint ?? ''} aria-label="Endpoint" />
          <input class="input input-bordered input-sm" name="credentialReference" autocomplete="off" placeholder="New credential reference (optional)" aria-label="New credential reference" />
          <button class="btn btn-primary btn-sm w-fit" type="submit">Save update</button>
        </form></details>
      </li>}</For></ul>
    </section>
    <section class="space-y-3 rounded-box border border-base-300 p-4" aria-labelledby="models-heading">
      <h2 id="models-heading" class="font-semibold">Models</h2>
      <Show when={(settings()?.providers.filter((provider) => provider.enabled).length ?? 0) > 0} fallback={<p class="text-sm text-base-content/70">Enable a provider before adding models.</p>}>
        <form class="grid gap-3 sm:grid-cols-2" onSubmit={submitModel}>
          <label class="form-control"><span class="label-text">Provider</span><select class="select select-bordered" name="providerId" required><For each={(settings()?.providers ?? []).filter((provider) => provider.enabled)}>{(provider) => <option value={provider.id}>{provider.type}</option>}</For></select></label>
          <label class="form-control"><span class="label-text">Model name</span><input class="input input-bordered" name="name" required placeholder="gpt-4.1-mini" /></label>
          <fieldset class="sm:col-span-2"><legend class="label-text">Capabilities</legend><For each={roles}>{(role) => <label class="mr-4 inline-flex min-h-11 items-center gap-2"><input class="checkbox checkbox-sm" type="checkbox" name={role} value={role} />{role}</label>}</For></fieldset>
          <button class="btn btn-primary w-fit" type="submit">Save model</button>
        </form>
      </Show>
      <div class="space-y-3"><For each={roles}>{(role) => <label class="form-control"><span class="label-text capitalize">{role} model</span><select class="select select-bordered" value={settings()?.assignments[role] ?? ''} onChange={(event) => event.currentTarget.value !== '' && void save(() => assignInferenceModel(role, event.currentTarget.value))}><option value="">No model selected</option><For each={(settings()?.models ?? []).filter((model) => model.capabilities.includes(role) && settings()?.providers.some((provider) => provider.id === model.providerId && provider.enabled))}>{(model) => <option value={model.id}>{model.name}</option>}</For></select></label>}</For></div>
    </section>
  </section>
}
