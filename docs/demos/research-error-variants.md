# Research error variants

`apps/web/e2e/research-error-variants.spec.ts` drives each typed `research-failed`
event through the served application. It verifies the guidance copy, keyboard
focus on the follow-up recovery control, and successful follow-up submission.

The suite captures the three failure states at 1440×900 and 390×844 in both
light and dark themes under `docs/demos/research-error-variants/`.

Run the focused browser regression with:

```sh
bun test --timeout 60000 --max-concurrency 1 apps/web/e2e/research-error-variants.spec.ts
```
