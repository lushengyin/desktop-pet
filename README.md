# desktop-pet

Lulu Desktop Pet is a macOS-first desktop pet app built with Electron, React, and TypeScript.

## Product Direction

- Desktop companion pet with transparent floating window
- Drag anywhere and remember position
- Adjustable pet size
- Menu bar controls
- Dark macOS-style settings panel
- Default pet: “噜噜” from existing Codex custom pet assets
- Custom pet import, preview, switching, and persistent settings

## Run

```bash
pnpm install
pnpm run dev
```

## Verify

```bash
pnpm run typecheck
pnpm run build
pnpm run smoke
pnpm run package
```

The local packaged app is written to `release/mac-arm64/Lulu Desktop Pet.app`.

## Current Status

The first complete local product build is implemented. The structured source of truth is in `project-data/`, with readable planning docs in `docs/`.

## Notes

- `pnpm` is the default package manager.
- If Electron binary installation stalls on the default source, rebuild it with:

  ```bash
  ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ pnpm rebuild electron
  ```

- The current macOS package uses ad-hoc signing and is not notarized.
