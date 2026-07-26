# Source-library notice top inset

## Goal
Keep the global source-library attachment notice clear of the central workspace's top edge.

## Change
Add responsive top padding to the existing `SourcesPage` content wrapper: 16px on compact widths and 24px from the `sm` breakpoint. The existing horizontal gutters and vertical `space-y-4` rhythm remain unchanged.

## Regression coverage
Extend the browser test to load `/sources` at 375px and 1440px and assert that the attachment notice is inset from the central scroll area by the matching responsive top gutter.

## Validation
Run the focused source-import Playwright spec, web typecheck, and vault validation.
