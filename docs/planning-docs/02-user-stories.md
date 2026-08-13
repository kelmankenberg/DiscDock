# User Stories & Epics

Stories are grouped by epic. Format: `As a <role>, I want <capability>, so that <benefit>.` Each includes acceptance criteria.

## Epic 1: Media Registration

### US-1.1 — Register a new media item
As a user, I want to register a new physical media item with a label, type, and capacity, so that I can track it in my catalog.
**Acceptance Criteria:**
- User can create a media record with: name/label, media type (CD, DVD, Blu-ray, USB drive, external HDD/SSD, SD card, other), capacity, notes, tags, and physical location.
- Media type list is extensible via settings (custom types).
- Newly created media appears immediately in the media list view.

### US-1.2 — Auto-detect inserted/connected media
As a user, I want DiscDock to detect when I insert a disc or plug in a drive, so that I can quickly register or select it without manually finding the mount path.
**Acceptance Criteria:**
- App listens for mount/unmount events on Linux (via udisks2 D-Bus or polling `lsblk`/`/proc/mounts` fallback).
- Detected device shows: mount path, filesystem label, filesystem type, capacity, used/free space.
- User can link a detected device to an existing media record or create a new one from it.

### US-1.3 — Assign physical storage location
As a user, I want to record where a physical item is stored (box/shelf/drawer), so that I can find it later.
**Acceptance Criteria:**
- Location is a free-form hierarchical field (e.g., "Garage > Box 3 > Shelf B") or selectable from previously used locations.
- Location is searchable/filterable in the media list.

## Epic 2: Scanning & Cataloging

### US-2.1 — Scan a mounted media item
As a user, I want to scan a connected media item's file system, so that all its files and folders are recorded in the catalog.
**Acceptance Criteria:**
- User selects a mounted media record and clicks "Scan".
- Scan recursively walks the directory tree, recording path, name, size, type/extension, created/modified timestamps.
- Progress bar shows files scanned, current path, and elapsed time.
- Scan is cancellable mid-way; partial results are kept (marked as incomplete scan).
- Symlinks are detected and not followed by default (configurable).

### US-2.2 — Content hashing for integrity/dedupe
As a user, I want to optionally compute checksums of files during a scan, so that I can detect duplicates and verify integrity later.
**Acceptance Criteria:**
- Hashing mode selectable per scan: None, Quick (partial/head hash), Full (SHA-256 whole file).
- Hash stored per file record.
- Hashing performance shown in progress UI (throughput, ETA).

### US-2.3 — Re-scan / verify existing media
As a user, I want to re-scan media I already catalogued, so that I can verify it still matches the recorded catalog (detect bit rot or missing files).
**Acceptance Criteria:**
- Re-scan compares new results to prior catalog: added, removed, modified, unchanged file counts.
- User can view a diff report after re-scan.
- "Last verified" timestamp updates on successful re-scan.

### US-2.4 — Background/queued scanning
As a user, I want to queue multiple scans, so that I can catalog several media items in sequence without babysitting each one.
**Acceptance Criteria:**
- Scan jobs show in a queue/history panel with status (queued, running, completed, cancelled, failed).
- Only one scan runs at a time by default (configurable concurrency).

## Epic 3: Search & Browse

### US-3.1 — Global search across all catalogued media
As a user, I want to search for a filename or keyword across my entire catalog, so that I can find which media item contains it without connecting anything.
**Acceptance Criteria:**
- Search box available from the top toolbar/global nav at all times.
- Results show file name, path, containing media item, size, and modified date.
- Search supports partial match and is reasonably fast on catalogs with 100k+ file rows.

### US-3.2 — Filter search results
As a user, I want to filter results by media type, file type/extension, size range, date range, and tags, so that I can narrow down large result sets.
**Acceptance Criteria:**
- Filter panel available alongside search results.
- Filters combine with AND logic; active filters are visibly listed and removable.

### US-3.3 — Browse a media item's folder tree
As a user, I want to browse the catalogued folder structure of a specific media item like a file explorer, so that I can review its contents.
**Acceptance Criteria:**
- Tree view expand/collapse of folders; file list pane for selected folder.
- Works fully offline (data from catalog, not live filesystem) with a badge if media currently connected vs. archived-only.

## Epic 4: Duplicate & Redundancy Detection

### US-4.1 — Duplicate file report
As a user, I want to see files that exist identically (by hash) on multiple media items, so that I know what's redundantly backed up and what's a single point of failure.
**Acceptance Criteria:**
- Report groups files by hash where hash exists and count > 1.
- Report shows each occurrence's media item and path.
- Files without a computed hash are excluded with a note to enable hashing.

## Epic 5: Tagging & Organization

### US-5.1 — Tag media items and files
As a user, I want to apply custom tags to media items (and optionally individual files), so that I can organize my catalog by project, year, or category.
**Acceptance Criteria:**
- Tags are freeform, autocompleted from existing tags, multiple per item.
- Tags filterable in search and media list.

### US-5.2 — Collections
As a user, I want to group multiple media items into a named collection, so that I can manage related items together (e.g., "2020 Backups").
**Acceptance Criteria:**
- Collections are user-created, many-to-many with media items.
- Collection detail view lists member media and aggregate stats (total size, file count).

## Epic 6: Media Health & Lifecycle

### US-6.1 — Track verification status
As a user, I want to see which media items haven't been verified in a long time, so that I can proactively check aging discs/drives before they fail.
**Acceptance Criteria:**
- Dashboard widget lists media not verified in > N months (configurable threshold).
- Media detail page shows last scanned/verified date and history log.

### US-6.2 — Record read errors / damage notes
As a user, I want to log read errors encountered when scanning, so that I have a record of degrading media.
**Acceptance Criteria:**
- Scan engine records unreadable files/paths with error type.
- Media detail shows an error count and list of problem paths.

## Epic 7: Data Portability

### US-7.1 — Export catalog
As a user, I want to export my catalog (all or filtered) to JSON/CSV, so that I can back it up or use it elsewhere.
**Acceptance Criteria:**
- Export scope selectable: entire catalog, single media item, or current filtered search results.
- Export runs as a background job with a completion notification and file save dialog.

### US-7.2 — Backup/restore the app database
As a user, I want to back up and restore my entire DiscDock database, so that I don't lose my catalog if my computer is reset.
**Acceptance Criteria:**
- "Backup Now" produces a single portable file (e.g., SQLite copy or compressed archive).
- "Restore from Backup" replaces/merges the current database with confirmation prompts and a pre-restore safety backup.

## Epic 8: Application Shell & Settings

### US-8.1 — Dashboard/home view
As a user, I want a home dashboard showing summary stats (total media, total files, total size, recent scans, aging media alerts), so that I get an overview at a glance.

### US-8.2 — Settings management
As a user, I want to configure scan defaults (hashing mode, exclude patterns, follow symlinks), mount directory watch paths, theme (light/dark), and notification preferences, so that the app behaves the way I want.

### US-8.3 — Media type & custom field management
As a user, I want to manage the list of media types and any custom metadata fields, so that the catalog fits my specific collection needs.
