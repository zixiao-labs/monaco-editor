# Horizon Git dependency builds

This fork exports `SourcedTextModel` from the package root. It tags synchronous
model projections with driver provenance without changing Monaco's native
content-change events or adding remote edits to the normal undo stack. Coordinates
remain Monaco UTF-16 positions; Horizon's persisted text edits use UTF-8 bytes.

The upstream build writes into `out/monaco-editor`, but a Git dependency is packed
from the repository root. `prepare` therefore builds the LSP client and editor,
then copies generated `esm`, `dev`, `min` and declarations to the package root.
The explicit `files` list includes those ignored products; bundles are not
committed. The release output removes `prepare` so it needs no build tools.
Husky is an optional developer command (`npm run dev:hooks`), not a consumer
postinstall that would require absent development dependencies.

## Local verification

```sh
npm ci
npm pack --pack-destination /path/to/temporary-directory
npm install --prefix /path/to/temporary-consumer /path/to/temporary-directory/monaco-editor-0.57.0.tgz
npx playwright test --config=test/smoke/playwright.config.ts \
  --project=amd-chromium -g 'sourced edits'
```

`npm ci` and `npm pack` run `prepare`; use `npm run build` for only the release
output or `npm run build:package` to prepare the root explicitly. Chromium can
use an existing executable by setting `MONACO_TEST_CHROMIUM_EXECUTABLE_PATH`.
The sourced-edit browser test covers remote edits, inverse edits, local undo,
nested sources, exception cleanup and disposal using a real Monaco text model.

## Updating Horizon

Building this checkout does **not** update Horizon's installed Git dependency.
After explicitly publishing this change to the fork, pin Horizon to the new
commit, approve this fork's dependency build in its `pnpm-workspace.yaml`
using the exact resolved artifact, regenerate the lockfile and reinstall.
pnpm 12 does not accept a package-name-only approval for a Git dependency:

```yaml
allowBuilds:
  "monaco-editor@https://codeload.github.com/zixiao-labs/monaco-editor/tar.gz/<full-commit>": true
```

Use the full commit from the package pin, and update this approval when changing
that pin. Do not use a blanket approval for unrelated artifacts sharing the name.
Verify the package's JavaScript **and** declaration entry points, not merely a
Horizon build that does not yet import Monaco. Never replace the Git pin with a
machine-specific absolute path or commit generated bundles to bypass publishing.
