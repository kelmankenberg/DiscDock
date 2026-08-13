# Functional Requirements

Numbered `FR-x.y` for traceability to user stories and test cases.

## FR-1: Media Registration & Detection

- **FR-1.1** The system shall allow manual creation of a media record with fields: name/label, media type, capacity (optional/auto-filled), physical location, notes, tags, color/icon (optional), created date.
- **FR-1.2** The system shall detect connected/mounted removable storage devices on Linux via `udisks2` D-Bus signals where available, with polling of `/proc/mounts` / `lsblk -J` as a fallback.
- **FR-1.3** The system shall present detected devices with: device path (e.g., `/dev/sdb1`), mount point, filesystem label, filesystem type, total/used/free capacity.
- **FR-1.4** The system shall allow linking a detected device to a new or existing media record.
- **FR-1.5** The system shall support at minimum media types: CD, DVD, Blu-ray, USB Flash Drive, External HDD, External SSD, SD Card/MicroSD, Network Share (read-only catalog use case), Other (custom).
- **FR-1.6** The system shall allow users to define custom media types.
- **FR-1.7** The system shall support optical media specifically: when a CD/DVD is inserted, read volume label via mount metadata; if no filesystem (raw audio CD), allow manual track listing entry or graceful "unsupported filesystem" messaging.

## FR-2: Scanning Engine

- **FR-2.1** The system shall recursively enumerate all files and directories under a selected root path (the mount point or a user-chosen subfolder).
- **FR-2.2** For each file, the system shall record: full relative path, file name, extension, size in bytes, created timestamp, modified timestamp, and (optionally) content hash.
- **FR-2.3** For each directory, the system shall record path and aggregate stats (file count, total size) computed post-scan.
- **FR-2.4** The system shall support exclude patterns (glob-based, e.g., `**/.Trash-*`, `**/System Volume Information`) configurable globally and per-scan.
- **FR-2.5** The system shall not follow symbolic links by default; this shall be a configurable option with loop protection when enabled.
- **FR-2.6** The system shall support three hashing modes: `none`, `quick` (first + last 64KB + size composite hash), `full` (streaming SHA-256 of entire file).
- **FR-2.7** The system shall report scan progress (files processed, bytes processed, current path, elapsed/estimated time) to the UI at least every 250ms.
- **FR-2.8** The system shall allow cancelling an in-progress scan; partial results already committed shall remain, and the scan record shall be flagged `incomplete`.
- **FR-2.9** The system shall record and surface I/O errors per file/path (permission denied, read error, I/O error) without aborting the overall scan.
- **FR-2.10** The system shall support only one active scan at a time by default, with additional scans queued (FIFO); a setting shall allow N concurrent scans.
- **FR-2.11** On re-scan of previously catalogued media, the system shall diff the new file listing against the prior catalog snapshot and classify entries as Added, Removed, Modified (size/mtime/hash changed), or Unchanged.
- **FR-2.12** The system shall update the media record's `last_scanned_at` and, if hashing was performed without integrity errors, `last_verified_at`.

## FR-3: Search & Browse

- **FR-3.1** The system shall provide a global search accessible from any screen, querying file name/path across the entire catalog.
- **FR-3.2** Search shall support partial/substring matching and be case-insensitive by default.
- **FR-3.3** Search results shall be filterable by: media type, specific media item(s), tag(s), file extension/category (e.g., image, video, document, audio, archive), size range, modified date range, and scan/verification status.
- **FR-3.4** The system shall provide a folder-tree browser per media item reflecting the catalogued structure, independent of whether the media is currently connected.
- **FR-3.5** If the media item is currently connected/mounted, the system shall offer a shortcut to open the live file/folder in the OS file manager.
- **FR-3.6** Search performance target: results returned in under 500ms for catalogs up to 500,000 file records on reference hardware (see NFRs).

## FR-4: Duplicate Detection

- **FR-4.1** The system shall provide a report grouping files with identical content hashes across the catalog where the group size is ≥ 2.
- **FR-4.2** The duplicate report shall display, per group: hash, file size, and list of (media item, path) occurrences.
- **FR-4.3** The system shall clearly indicate files excluded from duplicate detection because no hash was computed.
- **FR-4.4** The system shall provide summary stats: total duplicate groups, total reclaimable space if only one copy were kept (informational only — DiscDock does not delete files).

## FR-5: Tags & Collections

- **FR-5.1** The system shall support free-form tags on media items with autocomplete from existing tags.
- **FR-5.2** The system shall optionally support tags on individual files within a catalog (stretch for v1, required by v1.1).
- **FR-5.3** The system shall support user-defined Collections, a many-to-many grouping of media items, with name, description, and member list.
- **FR-5.4** Collection detail view shall show aggregate stats: member count, total size, total file count.

## FR-6: Media Health & Lifecycle

- **FR-6.1** The system shall display a "needs verification" indicator on media not scanned/verified within a configurable threshold (default 12 months).
- **FR-6.2** The system shall maintain a scan history log per media item (timestamp, hashing mode used, files added/removed/modified counts, error count).
- **FR-6.3** The system shall track cumulative read-error counts per media item and list affected paths.
- **FR-6.4** The system shall support marking a media item as Retired/Disposed without deleting its catalog history (soft-archival state).

## FR-7: Data Portability

- **FR-7.1** The system shall export catalog data (full, per-media, or filtered search results) to JSON and CSV formats via a native save dialog.
- **FR-7.2** The system shall support full database backup to a single portable file and restore from such a file, with a pre-restore automatic safety backup of the current database.
- **FR-7.3** Export/backup operations shall run as background jobs with progress and completion notification.

## FR-8: Application Shell

- **FR-8.1** The system shall provide a Dashboard/Home view summarizing: total media items, total files catalogued, total catalogued size, recent scan activity, and media needing verification.
- **FR-8.2** The system shall provide a Settings area covering: scan defaults (hashing mode, excludes, symlink handling, concurrency), device-watch behavior, theme (light/dark/system), notifications, and data management (backup/restore, database location).
- **FR-8.3** The system shall provide management UI for custom media types and any custom metadata fields.
- **FR-8.4** The system shall provide desktop notifications for: scan completed, scan failed, media needing verification (on app launch/periodic check), backup/export completed.

## FR-9: Packaging & Platform

- **FR-9.1** The system shall build distributable Linux packages: a `.deb` package installable via `dpkg`/`apt`, and a portable `.AppImage`.
- **FR-9.2** The system shall store its database and configuration under the XDG-compliant user data directory (e.g., `~/.config/DiscDock` / `~/.local/share/DiscDock`).
- **FR-9.3** The application shall register a desktop entry (`.desktop` file) with icon, for both packaging formats.
