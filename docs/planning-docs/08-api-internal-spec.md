# Internal API / IPC Contract

The renderer never accesses Node.js/Electron APIs directly. All communication goes through a preload-exposed `window.discdock` object backed by `contextBridge`, which wraps `ipcRenderer.invoke` (request/response) and `ipcRenderer.on` (event subscriptions). All `invoke` calls resolve to a discriminated result: `{ ok: true, data: T } | { ok: false, error: { code: string; message: string } }`.

## 1. Media

| Channel | Direction | Payload → | Returns |
|---|---|---|---|
| `media:list` | invoke | `{ filter?, sort?, page? }` | `MediaItem[]` with pagination meta |
| `media:get` | invoke | `{ id }` | `MediaItem` (with tags, latest scan summary) |
| `media:create` | invoke | `MediaItemInput` | `MediaItem` |
| `media:update` | invoke | `{ id, patch: Partial<MediaItemInput> }` | `MediaItem` |
| `media:delete` | invoke | `{ id }` | `{ deleted: true }` |
| `media:retire` | invoke | `{ id }` | `MediaItem` |
| `media:linkDevice` | invoke | `{ mediaId, devicePath }` | `MediaItem` |

## 2. Devices

| Channel | Direction | Payload / Notes |
|---|---|---|
| `devices:list` | invoke | Returns currently detected mounted removable devices |
| `devices:connected` | event (main→renderer) | Fired when a new device is mounted: `{ devicePath, label, fsType, mountPoint, sizeBytes }` |
| `devices:disconnected` | event | Fired on unmount: `{ devicePath }` |

## 3. Scanning

| Channel | Direction | Payload → | Returns / Notes |
|---|---|---|---|
| `scan:start` | invoke | `{ mediaId, rootPath, hashMode, excludePatterns?, followSymlinks? }` | `{ jobId }` (queues if another scan running) |
| `scan:cancel` | invoke | `{ jobId }` | `{ cancelled: true }` |
| `scan:progress` | event | — | `{ jobId, filesProcessed, bytesProcessed, currentPath, elapsedMs }` |
| `scan:completed` | event | — | `{ jobId, summary: ScanSummary }` |
| `scan:failed` | event | — | `{ jobId, error }` |
| `scan:history` | invoke | `{ mediaId }` | `ScanJob[]` |
| `scan:diff` | invoke | `{ jobId }` | Added/Removed/Modified/Unchanged file lists |

## 4. Files / Browse

| Channel | Direction | Payload → | Returns |
|---|---|---|---|
| `files:tree` | invoke | `{ mediaId, parentPath? }` | Folder children (lazy-loaded tree nodes) |
| `files:list` | invoke | `{ mediaId, folderPath }` | Files within a folder |
| `files:openInFileManager` | invoke | `{ mediaId, path }` | `{ opened: true }` (only if media currently connected) |

## 5. Search

| Channel | Direction | Payload → | Returns |
|---|---|---|---|
| `search:query` | invoke | `{ text, filters: SearchFilters, page }` | `FileSearchResult[]` + total count |

## 6. Duplicates

| Channel | Direction | Payload → | Returns |
|---|---|---|---|
| `duplicates:report` | invoke | `{ minGroupSize?, mediaTypeFilter? }` | Grouped duplicate results + summary |

## 7. Tags & Collections

| Channel | Direction | Payload → | Returns |
|---|---|---|---|
| `tags:list` | invoke | — | `Tag[]` |
| `tags:apply` | invoke | `{ targetType: 'media'\|'file', targetId, tagNames: string[] }` | updated tag list |
| `collections:list` / `create` / `update` / `delete` | invoke | standard CRUD | `Collection[]` / `Collection` |
| `collections:addMember` / `removeMember` | invoke | `{ collectionId, mediaId }` | `Collection` |

## 8. Export / Backup

| Channel | Direction | Payload → | Returns |
|---|---|---|---|
| `export:run` | invoke | `{ scope, format, destinationPath }` | `{ jobId }` |
| `export:progress` / `export:completed` | event | — | progress/result |
| `backup:run` | invoke | `{ destinationPath }` | `{ jobId }` |
| `backup:restore` | invoke | `{ sourcePath }` | `{ ok: true }` (after safety backup + confirmation already handled in renderer) |

## 9. Settings

| Channel | Direction | Payload → | Returns |
|---|---|---|---|
| `settings:get` | invoke | — | `AppSettings` |
| `settings:update` | invoke | `Partial<AppSettings>` | `AppSettings` |
| `mediaTypes:list` / `create` / `delete` | invoke | standard CRUD | `MediaType[]` |

## 10. Notifications & App

| Channel | Direction | Notes |
|---|---|---|
| `app:getVersion` | invoke | Returns app version for display in Settings/About |
| `notifications:show` | main-internal only | Not exposed to renderer directly; main process triggers OS notifications based on settings |

## 11. Window Controls

Backs the custom top toolbar / title-bar replacement required by the frameless window (see [UI/UX Specification §1](07-ui-ux-specification.md#1-application-shell) and [Technical Specification §3](05-technical-specification.md#3-window-management-frameless-shell)).

| Channel | Direction | Payload → | Returns / Notes |
|---|---|---|---|
| `window:minimize` | invoke | — | `{ ok: true }` |
| `window:maximize` | invoke | — | `{ ok: true }` (toggles maximize/restore) |
| `window:close` | invoke | — | `{ ok: true }` |
| `window:isMaximized` | invoke | — | `{ maximized: boolean }` (for initial toolbar icon state on load) |
| `window:stateChanged` | event (main→renderer) | — | `{ maximized: boolean }`, fired on native maximize/unmaximize so the toolbar can swap its Maximize/Restore icon |

## 12. Security Notes

- Every `invoke` handler validates its input payload shape (e.g., via a schema validator) before touching the database or filesystem; malformed requests return `ok: false` with a validation error code rather than throwing.
- Path-accepting channels (`files:openInFileManager`, manual root path selection) validate the resolved path stays within the expected media root / OS-provided picker result — never accept arbitrary renderer-supplied absolute paths without validation, to avoid path traversal from a compromised renderer.
- No channel exposes raw Node.js `child_process`, `fs`, or shell execution primitives to the renderer; all such operations are fully implemented in the main process and only their results are returned.
- Window-control channels (§11) only ever act on the single application `BrowserWindow` instance owned by the main process; they accept no renderer-supplied window handle/target, preventing a compromised renderer from manipulating other windows.

