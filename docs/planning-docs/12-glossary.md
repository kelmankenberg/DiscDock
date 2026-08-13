# Glossary

| Term | Definition |
|---|---|
| **Media Item** | A registered physical (or logical) storage unit tracked by DiscDock — e.g., a CD, DVD, USB flash drive, external HDD/SSD, or SD card. |
| **Catalog** | The set of file/folder metadata records DiscDock has stored for a given media item, produced by a scan. |
| **Scan** | The process of recursively walking a media item's file system and recording metadata (and optionally hashes) for every file/folder found. |
| **Hashing Mode** | The strategy used to fingerprint file contents during a scan: `none`, `quick` (partial hash), or `full` (whole-file SHA-256). |
| **Diff / Scan Diff** | Comparison between a new scan's results and the media item's prior catalog snapshot, classifying files as Added, Removed, Modified, or Unchanged. |
| **Verification** | Confirming a media item's catalog still matches reality via a re-scan (ideally with hashing) with no read errors; updates `last_verified_at`. |
| **Device Fingerprint** | An identifier (filesystem UUID, or a label+size heuristic) used to recognize the same physical device across multiple connect/disconnect sessions. |
| **Duplicate Group** | A set of two or more catalogued files across any media items sharing an identical content hash. |
| **Collection** | A user-defined, named grouping of multiple media items (many-to-many), used for organizational purposes (e.g., "2020 Backups"). |
| **Archived-only** | State of a media item's data view when the underlying device is not currently connected/mounted; browsing/search still works against the stored catalog snapshot. |
| **Connected** | State indicating the media item's underlying device is currently mounted and accessible on the system. |
| **Preload / contextBridge** | The Electron mechanism used to expose a narrow, safe API from the main process to the renderer without granting direct Node.js access. |
| **IPC (Inter-Process Communication)** | The Electron mechanism (`ipcMain`/`ipcRenderer`) used for renderer↔main process request/response and event messaging. |
| **XDG Base Directory** | The Linux convention for standard user config/data/cache directory locations (`~/.config`, `~/.local/share`, etc.) that DiscDock follows for storing its database, settings, and logs. |
| **AppImage** | A portable, self-contained Linux application package format that runs without installation. |
| **deb** | The Debian/Ubuntu native package format (`.deb`), installable via `dpkg`/`apt`. |
