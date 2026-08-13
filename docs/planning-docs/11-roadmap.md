# Roadmap & Release Plan

## Phase 0 — Foundations (Pre-MVP)
- Project scaffolding: Electron + React + TypeScript + Vite, electron-builder pipeline producing installable `.deb`/`.AppImage` (even with a blank window) to de-risk packaging early.
- SQLite integration with migration runner and base schema (`media_item`, `file_record`, `scan_job`).
- Preload/contextBridge IPC skeleton with the discriminated result pattern.

## Phase 1 — MVP

Scope: the minimum feature set that makes DiscDock genuinely useful end-to-end.

- Media registration (manual) — FR-1.1, FR-1.5, FR-1.6
- Linux device detection (udisks2 + fallback) and linking to media — FR-1.2–1.4
- Scanning engine: metadata-only and full-hash modes, progress, cancel — FR-2.1–2.10
- Re-scan with diff summary — FR-2.11, FR-2.12
- Global search with core filters — FR-3.1–3.4, FR-3.6
- Media Library list + Media Detail (Overview, Browse, Scan History) — UI spec §2.2–2.3
- Dashboard with summary stats and attention panel — FR-8.1
- Settings: scan defaults, theme, notifications — FR-8.2
- Backup/restore of the whole database — FR-7.2
- `.deb` + `.AppImage` packaging finalized with QA checklist passed — Packaging doc §7

**MVP exit criteria:** a user can register a drive, scan it, search across multiple scanned drives without connecting them, and back up/restore their catalog.

## Phase 2 — Post-MVP Enhancements

- Duplicate file detection & report — FR-4.1–4.4
- Tags on media + Collections — FR-5.1, 5.3, 5.4
- Media health/lifecycle tracking (verification threshold alerts, error logs, retire status) — FR-6.1–6.4
- CSV/JSON export of catalog/search results — FR-7.1
- Custom media types & custom metadata fields — FR-8.3

## Phase 3 — Stretch / Future Ideas

- File-level tagging (FR-5.2) and per-file notes.
- Printable labels/QR codes linking a physical media item to its DiscDock record (scan QR to jump straight to Media Detail).
- Optical media raw audio CD track listing support (FR-1.7 non-filesystem case).
- Auto-update via `electron-updater`.
- Windows/macOS builds (architecture already avoids Linux-only assumptions in the app layer; device-detection module would need a per-OS implementation).
- Basic in-app preview for still-connected media (open image/video with system default viewer) beyond just "Open in File Manager".
- Multi-concurrency scanning (scan several connected devices simultaneously) as a configurable power-user setting.

## Out of Scope (Explicitly, for the foreseeable roadmap)

- Cloud sync/multi-device catalog sharing.
- Backing up actual file contents (DiscDock indexes, it does not archive/copy data).
- Disc burning/writing capability.
