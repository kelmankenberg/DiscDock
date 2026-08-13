# UI/UX Specification

## 1. Application Shell

- **Layout:** Fixed left sidebar navigation + top toolbar + main content area, standard desktop app pattern.
- **Left Sidebar (collapsible):** Dashboard, Media Library, Search, Duplicates, Collections, Backup/Export, Settings.
- **Top Toolbar:** Global search input (always accessible), "Add Media" quick action, active scan job indicator (spinner + count badge linking to Scan Queue), theme toggle.
- **Theming:** Light and Dark themes, following OS preference by default, override in Settings.

## 2. Screens

### 2.1 Dashboard (Home)
- Summary cards: Total Media Items, Total Files Catalogued, Total Catalogued Size, Media Needing Verification.
- "Recent Scans" list (last 5) with status and quick link to scan report.
- "Attention Needed" panel: media not verified within threshold, media with unresolved read errors.
- "Quick Add Media" button and "Detected Devices" panel showing currently connected/mounted devices not yet linked to a media record.

### 2.2 Media Library (List View)
- Table/grid of all media items: label, type icon, physical location, size, file count, last scanned, verification status badge.
- Filter/sort by type, location, tag, status (active/retired), verification age.
- Row actions: Scan, View Detail, Edit, Retire, Delete (with confirmation).
- Bulk actions: tag multiple, add to collection, export selection.

### 2.3 Media Detail
- Header: label, type, location, tags, status, edit button.
- Tabs:
  - **Overview** — capacity/used stats, last scanned/verified dates, scan history table.
  - **Browse** — folder tree (left) + file list (right) reflecting the catalogued snapshot; badge indicates if currently connected (live) or archived-only.
  - **Scan History** — list of past scan jobs with diff summaries (added/removed/modified/error counts); click to expand full diff.
  - **Errors** — list of recorded read errors (path, type, message) across all scans.
- Primary actions: "Scan Now" (disabled with tooltip if not connected/no root path set), "Locate Root Folder" (manual path picker for archived media re-import or non-standard mounts).

### 2.4 Scan Progress (Modal/Panel)
- Non-blocking panel (can navigate away): progress bar, files processed / bytes processed, current path, elapsed/ETA, Cancel button.
- On completion: summary toast + link to scan report; on error: error summary with retry option.

### 2.5 Search
- Persistent search bar (also present in top toolbar — this view is the full-results experience).
- Left filter panel: media type, media item picker, tags, file kind (image/video/audio/document/archive/other), size range slider, date range picker.
- Results table (virtualized): file name, path, media item (link to detail), size, modified date, tags.
- Row action: "Show in Media Detail" (jumps to Browse tab at that path); if media connected, "Open in File Manager".

### 2.6 Duplicate Report
- Grouped list: each group shows file size, hash (truncated, expandable), and occurrence list (media item + path).
- Filter by minimum group size, media type, file kind.
- Summary header: total duplicate groups, total files involved, total reclaimable space (informational).

### 2.7 Collections
- Grid/list of collections with member count and aggregate size.
- Collection detail: description, member media items (add/remove), aggregate stats.

### 2.8 Backup / Export
- **Export** section: scope selector (All / Single Media / Current Search Filter), format (JSON/CSV), destination picker, "Export" button, progress + history of past exports.
- **Database Backup** section: "Backup Now" (choose destination), "Restore from Backup" (choose file, confirmation dialog explaining a safety backup will be taken first), list of recent backups with timestamps.

### 2.9 Settings
- **Scanning Defaults:** hashing mode (none/quick/full), exclude patterns editor, follow-symlinks toggle, scan concurrency.
- **Devices:** watch behavior (auto-detect on/off), configured additional mount root paths to watch.
- **Appearance:** theme (light/dark/system).
- **Notifications:** toggles for scan completed/failed, verification reminders, backup/export completed.
- **Media Types & Custom Fields:** manage the list of media types; manage custom metadata fields available on media records.
- **Data Management:** database file location (read-only display), link to Backup/Export screen, "Reset Application Data" (destructive, requires typed confirmation).

## 3. Key Interaction Patterns

- **Empty states** everywhere (no media yet, no search results, no duplicates found) include a short explanation and a primary call-to-action button.
- **Destructive actions** (delete media, restore backup, reset app data) always require an explicit confirmation dialog; irreversible ones require typing a confirmation phrase.
- **Long operations** (scan, export, backup, restore) never block the UI thread; users can navigate elsewhere and are notified on completion via in-app toast + OS notification (if enabled).
- **Connected vs. archived indicator**: any media-related view shows a clear badge — "Connected" (green) vs. "Archived / Not Connected" (grey) — since Browse/Search reflect the catalog snapshot regardless of live connection state.

## 4. Accessibility

- All interactive elements keyboard-reachable in logical tab order.
- Color is never the sole indicator of state (status badges include text/icon, not just color).
- Minimum contrast ratios per WCAG AA for both themes.
