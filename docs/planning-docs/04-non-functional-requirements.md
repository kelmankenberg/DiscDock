# Non-Functional Requirements

## 1. Performance

- **NFR-1.1** Scanning throughput: capable of enumerating ≥ 2,000 files/second on metadata-only scans (no hashing) on reference hardware (SATA/USB 3.0 speeds).
- **NFR-1.2** Full-hash scanning throughput bounded primarily by device read speed; UI must remain responsive (no main-thread blocking) regardless of scan size.
- **NFR-1.3** Global search over a catalog of 500,000 file rows shall return first-page results in < 500ms (indexed SQLite queries).
- **NFR-1.4** Application cold start (from launch to interactive Dashboard) shall be < 3 seconds on reference hardware with a catalog of up to 100,000 file rows.
- **NFR-1.5** All filesystem scanning and hashing work shall occur off the Electron main UI thread (Node.js worker threads or a dedicated utility process) to avoid freezing the renderer.

## 2. Reliability & Data Integrity

- **NFR-2.1** The catalog database shall use transactional writes (SQLite with WAL mode) so a crash or power loss mid-scan does not corrupt previously committed data.
- **NFR-2.2** Schema migrations shall be versioned and applied automatically on startup with a rollback-safe backup taken before migration.
- **NFR-2.3** No user data (catalog, tags, settings) shall be lost across an application version upgrade.
- **NFR-2.4** Scan jobs shall be resumable/cancellable without leaving the database in an inconsistent state (partial scans clearly flagged, not silently merged as complete).

## 3. Compatibility

- **NFR-3.1** Supported OS (v1): Linux distributions using glibc, tested against at least one Debian-based (Ubuntu LTS) and one RPM-based or Arch-based distro for AppImage compatibility.
- **NFR-3.2** `.deb` package shall declare correct dependency metadata and install cleanly via `dpkg -i` / `apt install ./package.deb`.
- **NFR-3.3** `.AppImage` shall run without installation on distros supporting FUSE (or `--appimage-extract-and-run` fallback documented).
- **NFR-3.4** Device detection shall degrade gracefully (manual folder picker) on systems lacking `udisks2`.

## 4. Usability & Accessibility

- **NFR-4.1** UI shall support both light and dark themes, following OS preference by default.
- **NFR-4.2** Core workflows (register media, scan, search) shall be completable without consulting documentation (discoverable UI, inline empty-states with guidance).
- **NFR-4.3** Keyboard navigation shall be supported for primary flows (search, list navigation, dialogs) and standard focus/ARIA semantics respected in the renderer markup.
- **NFR-4.4** Long-running operations (scan, export, backup) shall always show progress feedback and be cancellable where safe.

## 5. Security & Privacy

- **NFR-5.1** The application shall not transmit any catalog data or file contents off the local machine (no network calls beyond optional update checks).
- **NFR-5.2** The Electron renderer shall run with `contextIsolation: true`, `nodeIntegration: false`, and a strict `sandbox: true` where feasible; all privileged operations shall go through a defined `contextBridge` preload API.
- **NFR-5.3** A Content Security Policy shall be enforced in the renderer restricting script/style sources to the packaged app bundle.
- **NFR-5.4** The application shall not require root/sudo privileges for normal operation; any privilege-requiring feature (if added later) must use explicit, isolated escalation (e.g., polkit) with clear user consent.
- **NFR-5.5** File hashing and scanning shall only read file metadata/content the user explicitly points the app at (mounted media or chosen folders); no background scanning of the whole filesystem.
- See [Security & Privacy](10-security-privacy.md) for full threat model.

## 6. Maintainability

- **NFR-6.1** Codebase shall separate main process, preload, and renderer with clear module boundaries; scanning logic implemented as an isolated, testable service independent of Electron APIs where possible.
- **NFR-6.2** Automated tests (unit + integration) shall cover: scan diffing logic, hashing modes, search/filter query building, database migrations.
- **NFR-6.3** Linting/formatting (ESLint + Prettier or equivalent) enforced via CI on all commits/PRs.

## 7. Observability

- **NFR-7.1** The application shall maintain a local rotating log file (main process) capturing errors and key lifecycle events (scan start/stop/errors, migrations) for support/debugging, stored under the app's user data directory.
- **NFR-7.2** Unhandled exceptions in main or renderer shall be caught, logged, and surfaced to the user via a non-blocking error notification rather than a silent crash where possible.

## 8. Scalability (Local Data Scale)

- **NFR-8.1** Application shall remain usable (not just "not crash") with catalogs up to: 1,000 media items, 2,000,000 total file rows, and a database file size up to several GB.
- **NFR-8.2** Pagination/virtualized lists shall be used for any UI list that could exceed a few thousand rows (file lists, search results).
