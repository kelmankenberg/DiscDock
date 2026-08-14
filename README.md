# DiscDock

Catalog and search your external/removable media collection (CDs, DVDs, USB drives, external HDD/SSD, SD cards) without needing to reconnect the physical media.

Planning documentation: [docs/planning-docs](docs/planning-docs/README.md)

## Status

v0.1.0 — Linux-first cataloging application with media registration, removable-device detection, scanning, hashing, search, duplicate reports, tags, collections, backup/restore, export, contextual Help, and `.deb`/`AppImage` packaging. Initial-release hardening is tracked in the [release-readiness checklist](docs/planning-docs/14-release-readiness-checklist.md).

## Development

```bash
npm install
npm run dev            # Vite dev server + Electron with hot reload
```

DiscDock uses TypeScript 7 for development and release builds. TypeScript and Node.js are build-time prerequisites only; packaged users do not need to install them.

Linux development and device workflows use `lsblk`; safe removal uses `udisksctl`, and optical-disc eject uses `eject`. Audio CD TOC cataloging additionally needs `cd-info` or `cdparanoia`. These optional utilities are not required for ordinary folder-based cataloging.

## Building

```bash
npm run build          # Compile renderer (Vite) and main/preload (tsc)
npm run package:linux   # Build + package as .deb and .AppImage (release/)
npm test               # Unit tests plus Electron-runtime database integration tests
npm run typecheck      # Renderer and Electron TypeScript checks
```

Native modules (`better-sqlite3`) are rebuilt for Electron's ABI automatically via the `postinstall` script (`electron-builder install-app-deps`).

DiscDock is offline-first. Core registration, scanning, searching, backup, restore, and export do not require network access. Audio CD title/cover enrichment and automatic update checks are opt-in settings. DiscDock catalogs metadata and does not back up the original file contents.
