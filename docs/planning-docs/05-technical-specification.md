# Technical Specification

## 1. Technology Stack

| Layer | Choice | Notes |
|---|---|---|
| Application shell | **Electron** (latest stable) | Main + preload + renderer processes |
| Renderer UI | **React + TypeScript**, Vite bundler | Fast dev/build; component-driven |
| State management | React context + a lightweight store (e.g., Zustand) | Avoid over-engineering; no Redux needed |
| Styling | CSS Modules or Tailwind CSS | Team preference; must support light/dark theming |
| Main process language | **TypeScript** (compiled Node.js) | Shared types with renderer via a `shared/` package |
| Local database | **SQLite** via `better-sqlite3` | Synchronous, fast, WAL mode enabled |
| Scanning/hashing workers | Node.js `worker_threads` (or a dedicated Electron **Utility Process**) | Keeps main/renderer responsive |
| Device detection (Linux) | `udisks2` over D-Bus (`dbus-next` or similar), fallback to `lsblk -J` / `/proc/mounts` parsing | No root required for user-mounted media |
| Packaging | **electron-builder** | Targets: `deb`, `AppImage` |
| Testing | Vitest/Jest (unit), Playwright (E2E renderer) | Scan/diff logic unit-tested independent of Electron |
| Logging | `electron-log` or equivalent rotating file logger | Main-process centric |

## 2. High-Level Architecture

```mermaid
flowchart LR
    subgraph Renderer[Renderer Process (React UI)]
        UI[Views: Dashboard, Media List, Media Detail, Search, Settings]
    end
    subgraph Preload[Preload (contextBridge)]
        API[window.discdock API surface]
    end
    subgraph Main[Main Process]
        IPC[IPC Handlers]
        Svc[Application Services]
        DB[(SQLite DB via better-sqlite3)]
        Dev[Device Detection Service - udisks2/lsblk]
    end
    subgraph Worker[Scan Worker Threads / Utility Process]
        Scanner[Filesystem Walker + Hasher]
    end

    UI <--> API
    API <--> IPC
    IPC --> Svc
    Svc --> DB
    Svc --> Dev
    Svc --> Worker
    Worker --> DB
```

**Process boundaries:**
- **Renderer**: pure presentation, no direct Node/fs access. Communicates only via the preload-exposed API (`window.discdock.*`).
- **Preload**: thin `contextBridge` layer exposing a typed, minimal API (invoke/on wrappers) — no business logic.
- **Main process**: owns the SQLite connection, device detection, job orchestration (scan queue), and IPC handler registration.
- **Worker threads / utility process**: perform the actual recursive directory walk and hashing so scans never block the main process event loop (which also services IPC and DB writes). Workers stream progress messages and batched file records back to the main process, which performs batched DB inserts.

## 3. Module Breakdown (Main Process)

- `db/` — SQLite connection setup, migrations runner, repositories (MediaRepository, FileRepository, TagRepository, ScanRepository, CollectionRepository).
- `devices/` — device detection service abstracting udisks2/lsblk, emits `device-connected` / `device-disconnected` events.
- `scanning/` — scan job manager (queue, concurrency control), worker pool, diffing engine (compares new scan results to prior snapshot).
- `hashing/` — pluggable hash strategies (none/quick/full).
- `search/` — query builder translating UI filter state into parameterized SQL against indexed columns/FTS table.
- `export/` — JSON/CSV export and DB backup/restore routines.
- `ipc/` — one handler module per feature area, registered against typed channel names (see [IPC contract](08-api-internal-spec.md)).
- `notifications/` — wraps Electron `Notification` API for scan/backup/verification alerts.
- `logging/` — rotating file logger, unhandled exception hooks.

## 4. Module Breakdown (Renderer)

- `views/` — Dashboard, MediaList, MediaDetail, Search, DuplicateReport, Collections, Settings, Backup.
- `components/` — shared UI (DataTable/virtualized list, TagInput, ProgressBar, FolderTree, FilterPanel).
- `store/` — client-side state (current media selection, active filters, scan job status subscriptions).
- `api/` — typed wrapper around `window.discdock` calls (mirrors preload surface 1:1).

## 5. Scanning Engine Design

1. User triggers a scan on a media record (must have a resolved root path — either the live mount point or a manually chosen folder for archived/disconnected media re-import).
2. Main process enqueues a `ScanJob` (status `queued`) and, when its turn comes, spawns/dispatches to a worker.
3. Worker performs an iterative (non-recursive-call-stack) directory walk using a stack/queue to avoid stack overflow on deep trees, applying exclude-glob filtering.
4. For each file: capture `stat()` metadata; if hashing enabled, stream the file through the configured hash strategy.
5. Worker batches results (e.g., every 500 rows or 1 second) and posts them to the main process; main process performs a single SQL transaction per batch insert into a staging table.
6. On completion, the diff engine compares the staging batch set against the prior snapshot (by path) to classify Added/Removed/Modified/Unchanged, then commits the staging data as the new authoritative snapshot in one transaction, updates `media.last_scanned_at` (and `last_verified_at` if hashing succeeded with no errors).
7. Progress events (`scan:progress`) are forwarded to the renderer via IPC throughout; a final `scan:completed` (or `scan:failed` / `scan:cancelled`) event is emitted.
8. Cancellation: renderer sends `scan:cancel(jobId)`; worker checks a cancellation flag between files and exits cleanly; already-inserted staging rows are discarded (job marked `cancelled`, prior snapshot untouched).

## 6. Device Detection Design (Linux)

- Primary: subscribe to `udisks2` D-Bus signals (`InterfacesAdded`/`InterfacesRemoved` on `org.freedesktop.UDisks2`) to detect block device/filesystem mount changes in real time.
- Fallback: poll `/proc/mounts` (or run `lsblk -J -o NAME,LABEL,FSTYPE,MOUNTPOINT,SIZE,RM`) every few seconds if D-Bus is unavailable (e.g., minimal/sandboxed environments), diffing against the previous poll to synthesize connect/disconnect events.
- Detected devices are matched to existing media records via a stored device fingerprint (filesystem UUID where available, else label + size heuristic) so the same USB drive is recognized across sessions.

## 7. Search Implementation

- SQLite FTS5 virtual table indexing file `name` and `path` for fast substring/prefix search, joined back to the main `files` table for metadata/filter columns.
- Structured filters (media type, size range, date range, tags) compiled into a parameterized `WHERE` clause combined with the FTS `MATCH` query.
- Pagination via `LIMIT`/`OFFSET` with a stable sort key; renderer uses a virtualized list to render only visible rows.

## 8. Error Handling Strategy

- All IPC handlers wrap calls in try/catch, returning a discriminated `{ ok: true, data } | { ok: false, error }` result shape (no thrown exceptions crossing the IPC boundary).
- Scan/worker errors are captured per-file (I/O errors don't abort the whole job) and job-level (uncaught worker crash marks the job `failed` with a logged stack trace).
- Renderer surfaces recoverable errors via toast/notification components; fatal/unexpected errors are logged and shown via a generic error boundary.

## 9. Build & Dev Workflow

- Vite dev server for renderer HMR; Electron main/preload compiled via `tsc`/`esbuild` watch.
- `electron-builder` config (see [Packaging & Deployment](09-packaging-deployment.md)) drives `.deb` and `.AppImage` output from a single build pipeline.
- CI: lint → unit tests → build renderer + main → package (deb/AppImage) → smoke test artifact.
