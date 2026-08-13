# Product Requirements Document (PRD)

## 1. Overview

**Product:** DiscDock
**Type:** Electron desktop application
**Target OS (v1):** Linux (`.deb` package, `.AppImage`)
**Elevator Pitch:** DiscDock lets you scan any external or removable media once, catalog everything on it, and then search, browse, and locate files across your entire physical media collection — without ever having to plug the drive or disc back in.

## 2. Problem Statement

People accumulate large collections of physical/removable storage over the years: burned CDs/DVDs from the 2000s, backup external hard drives, USB flash drives, SD cards, old NAS exports, etc. There is no easy way to know:

- What is actually stored on a given disc/drive without inserting it.
- Which physical item contains a specific file, folder, or type of content.
- Whether a file has been backed up in multiple places (redundancy) or is a duplicate.
- Which drives/discs are aging, unread in years, or unverified.

DiscDock solves this by building a searchable local catalog (index) of file metadata (name, path, size, type, hash, dates) tied to a physical media record, without needing to keep the media connected or store the actual files.

## 3. Goals

1. Allow a user to register a physical media item (disc, USB key, external drive, SD card) with descriptive metadata (label, type, physical location).
2. Scan the media's file system and persist a full catalog (folder tree + file metadata) to a local database.
3. Provide fast full-text and filtered search across all catalogued media, even when disconnected.
4. Detect duplicate files across media using content hashing.
5. Track the physical location of media items (e.g., "Box 3, Shelf B") for easy retrieval.
6. Notify users about aging/unverified media that may need to be re-checked for read errors (bit rot, degraded optical media).
7. Package cleanly for Linux as both `.deb` and `.AppImage` with no non-Linux distribution required for v1.

## 4. Non-Goals (v1)

- Cloud sync or multi-device sync.
- Actually backing up/copying file contents into DiscDock (this is a catalog/index, not a backup tool).
- Windows/macOS builds (architecture should not preclude it later, but not delivered in v1).
- Media burning/writing (creating new CDs/DVDs).
- Streaming/playback of media content from within the app (may be a stretch goal for local files still connected).

## 5. Target Users & Personas

| Persona | Description | Key Need |
|---|---|---|
| **Home Archivist** | Has 100+ burned discs and several backup drives from over a decade | Find "which disc has my 2011 wedding photos" |
| **IT Hobbyist / Homelab User** | Manages spare drives, USB keys, recovery media | Inventory of what's on each drive, avoid re-scanning |
| **Creative Professional** | Photographer/videographer with many external drives of raw footage | Locate footage by shoot/project without connecting every drive |
| **Small Office/Lab Admin** | Manages a shelf of backup/archive media for compliance | Physical location tracking + verification/audit trail |

## 6. Key Features (Summary)

- Media registration wizard (type, label, capacity, physical location, notes, tags)
- Automatic detection of inserted/mounted removable media (via udisks2/lsblk on Linux)
- Recursive file-system scan with progress reporting, producing a full folder/file catalog
- Content hashing (configurable: none / quick / full SHA-256) for duplicate & integrity detection
- Global search (filename, path, tags, media label) with filters (media type, file type, size, date, tags)
- Duplicate file report across the whole catalog
- Physical location & container hierarchy (e.g., Box → Shelf → Media)
- Media health/status tracking: last verified date, read error count, "needs re-verification" flags
- Tagging and collections (user-defined groupings, e.g., "Tax Records 2015-2019")
- Catalog import/export (JSON/CSV) and full database backup/restore
- Reporting/dashboard: storage totals by type, media count, duplicate summary, aging media

## 7. Success Metrics

- Time to catalog a 50GB drive with 20,000 files completes within acceptable UX (progress shown, cancellable, resumable).
- Search returns results across 100+ catalogued media items in under 500ms for typical queries (indexed DB).
- Zero data loss on catalog database across app updates (migrations tested).
- Successful `.deb` install and `.AppImage` execution on at least two major Linux distros (e.g., Ubuntu LTS, Fedora) for QA.

## 8. Assumptions & Constraints

- Local-only storage; catalog database lives in the user's local app-data directory (e.g., SQLite file).
- Linux desktop environment provides standard mount points (`/media`, `/run/media`, or user-configured) and `udisks2`/`lsblk`/`blkid` are available for device metadata; app must gracefully degrade (manual path selection) if unavailable.
- Application does not require elevated/root privileges for normal scanning of user-mounted media.
- Users are responsible for physically labeling their media consistent with the app's registered metadata (app can generate printable labels/QR codes as a nice-to-have).

## 9. Stakeholders

- Product Owner (defines scope/priorities)
- Development Team (Electron/Node engineers, UI/UX)
- QA (packaging verification across distros)
- End users (personas above), via beta feedback
