# Security & Privacy

## 1. Data Handling Principles

- DiscDock is a **local-first, offline-by-default** application. It stores only file *metadata* (names, paths, sizes, timestamps, optional hashes) — never file contents — in its local SQLite database.
- No catalog data, file names, or hashes are transmitted off the user's machine. There is no backend service in v1.
- Optional network activity consists of the manual/opt-in update check and optional audio-CD enrichment through MusicBrainz and Cover Art Archive. Both are disabled by default and must be clearly disclosed when enabled.

## 2. Electron Hardening

- `contextIsolation: true` and `nodeIntegration: false` on all `BrowserWindow` instances.
- `sandbox: true` for the renderer where feature compatibility allows.
- Renderer loads only the packaged local `index.html`/bundle — no remote URLs are ever loaded in a `BrowserWindow`.
- A Content-Security-Policy meta tag is set on the renderer document: scripts and images are local/data-only, and no remote source is allowed. `style-src 'unsafe-inline'` is currently required for the Help panel's persisted dynamic width and is a narrowly reviewed exception; it does not permit inline scripts.
- `webSecurity` remains enabled (not disabled) in all environments, including development.
- All privileged capabilities (filesystem scanning, DB access, device detection) are implemented only in the main process and exposed to the renderer exclusively via a narrow, typed `contextBridge` API (see [IPC contract](08-api-internal-spec.md)) — the renderer never receives direct `fs`, `child_process`, or `require` access.
- `shell.openPath` / `openExternal` usage (e.g., "Open in File Manager") validates the target path is within a known media root before invoking, to prevent a compromised renderer from directing the OS to open arbitrary system paths.

## 3. Input Validation

- Every IPC handler validates payload shape and types before use with shared type guards and rejects malformed requests with a structured error rather than throwing raw exceptions. Integration tests for malformed IPC calls remain a release test gap.
- Glob-based exclude patterns and manually entered root paths are validated/normalized (e.g., resolved to an absolute path, checked for existence and directory-type) before being handed to the scanning engine.
- CSV/JSON export writes are limited to a user-chosen destination via the native save dialog (no arbitrary path acceptance from renderer-supplied strings).

## 4. Least Privilege

- The application never requests or requires root/sudo privileges for its core scanning/cataloging functions, since it only reads user-mounted media the OS has already made accessible to the user's session.
- Device detection uses read-only D-Bus signal subscriptions (`udisks2`) or read-only inspection commands (`lsblk`, reading `/proc/mounts`); no mount/unmount/format operations are performed by DiscDock.

## 5. Local Data at Rest

- The SQLite database is stored under the user's private home directory (`~/.local/share/DiscDock/`) with standard OS file permissions (not world-readable beyond default user-profile permissions).
- No encryption at rest is provided in v1 (matches the sensitivity level of metadata-only catalog data); if a future version stores anything more sensitive, DB-level encryption (e.g., SQLCipher) should be reconsidered.
- Backup files produced by the Backup/Export feature inherit the same "you chose the destination" model — DiscDock does not automatically copy backups anywhere the user didn't explicitly select.

## 6. Dependency & Supply Chain Hygiene

- Lockfile (`package-lock.json`) committed; CI runs dependency audit (`npm audit` or equivalent) as part of the pipeline, failing on new high/critical vulnerabilities in direct dependencies.
- Electron and Chromium kept on a supported/current major version to receive security patches; upgrade cadence tracked as a maintenance task.
- Native modules (`better-sqlite3`, D-Bus bindings) sourced from maintained, widely used packages; prebuilt binaries verified against the target Electron ABI during CI packaging.

## 7. Threat Model Summary

| Threat | Mitigation |
|---|---|
| Malicious/compromised renderer content attempts filesystem access | No nodeIntegration, contextIsolation on, strict preload API surface, no remote content loaded |
| Path traversal via crafted IPC payload | Path validation/normalization in main-process handlers before any fs/db operation |
| Corrupted media causing crash during scan | Per-file error capture; scan continues; job-level try/catch prevents the main-process scan manager from crashing |
| Data loss from bad migration or restore | Automatic safety backup before migrations and before restore operations |
| Supply-chain vulnerability in a dependency | Lockfile + CI audit gate, minimal dependency footprint |
| Unintended network exfiltration | No network calls in core flows; only opt-in update check, clearly disclosed |
