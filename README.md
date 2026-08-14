# DiscDock

Catalog and search your external/removable media collection (CDs, DVDs, USB drives, external HDD/SSD, SD cards) without needing to reconnect the physical media.

Planning documentation: [docs/planning-docs](docs/planning-docs/README.md)

## Status

v0.1.0 — foundational app shell: frameless window with custom title bar, sidebar navigation, SQLite-backed dashboard, and Linux (`deb`/`AppImage`) packaging pipeline. Feature work (scanning, search, tagging, etc.) is tracked in the [roadmap](docs/planning-docs/11-roadmap.md).

## Development

```bash
npm install
npm run dev            # Vite dev server + Electron with hot reload
```

DiscDock uses TypeScript 7 for development and release builds. TypeScript and Node.js are build-time prerequisites only; packaged users do not need to install them.

## Building

```bash
npm run build          # Compile renderer (Vite) and main/preload (tsc)
npm run package:linux   # Build + package as .deb and .AppImage (release/)
```

Native modules (`better-sqlite3`) are rebuilt for Electron's ABI automatically via the `postinstall` script (`electron-builder install-app-deps`).
