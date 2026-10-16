# Changelog

Notable features, enhancements, and fixes for each DiscDock release.

## 0.2.0 - Unreleased

### Features

- Added audio playback for catalogued audio files.
- Added Linux desktop shortcut creation.
- Added an in-app changelog panel.
- Unified Help and Changelog in a shared slide-out panel with a persistent, adjustable 25–50% width.
- Added page-specific Help coverage for the features on each view.
- Added isolated development data so the Arch/Omarchy development build can run beside an installed copy.

### Enhancements

- Improved image decoding and dashboard statistics.
- Expanded Search with a full-width query field, wrapping filters, and a filter visibility toggle.
- Added collapsible Help sections and live Help/Changelog search with highlighted matches.
- Refactored application modules for easier maintenance.

### Fixes

- No additional fixes recorded for this version yet.

## 0.1.0

### Features

- Registered removable media and catalogued file metadata with metadata-only, quick-hash, and full SHA-256 scans.
- Searched files across connected and disconnected media, with media, kind, tag, size, date, scan-status, and verification filters.
- Managed duplicate reports, tags, file annotations, collections, custom media types, and custom fields.
- Backed up and restored the catalog, including safety backups and validation, and exported catalog data to CSV or JSON.
- Detected Linux removable devices, supported safe removal, and catalogued audio CDs.
- Included contextual Help, verification reminders, Linux packages, and automatic update support.

### Enhancements

- Added scan progress, cancellation, history, error reporting, and verification reminders.
- Added live Search, filtered CSV export, sortable library columns, batch actions, and directory statistics.
- Added optional audio CD metadata and cover art enrichment.
- Added keyboard shortcuts, a collapsible sidebar, and persistent window and Help-panel sizing.

### Fixes

- Corrected optical-drive detection and surfaced actionable errors when safe removal is blocked by busy mounts.
- Fixed search matching for punctuation-containing queries and a Media Library filter initialization crash.
- Prevented scan symlink loops and paths escaping the selected media root.
- Rebuilt the full-text search index during database migrations.
- Hardened IPC validation and restricted privileged IPC access to trusted renderer origins.