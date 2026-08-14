# DiscDock Initial Release Readiness Checklist

Status: **Not release-ready**

Related: [Roadmap & Release Plan](11-roadmap.md), [Functional Requirements](03-functional-requirements.md), [Non-Functional Requirements](04-non-functional-requirements.md), [Packaging & Deployment](09-packaging-deployment.md), [Security & Privacy](10-security-privacy.md)

## Purpose

This document is the working gate for the first public Linux release of DiscDock. It records the remaining work found during the holistic application audit and defines the evidence required before release.

The initial release is Linux-first and targets `.deb` and `.AppImage`. Post-MVP enhancements and explicitly deferred ideas are not release blockers unless they affect the MVP workflows or release safety.

## Status Legend

- [ ] Not started
- [~] In progress or partially implemented
- [x] Complete and verified with evidence
- [!] Blocked or requires a product decision

## Release Gate Summary

### Must complete before initial release

- [ ] Automated tests and CI quality gates
- [ ] Scan cancellation and partial-scan semantics
- [ ] Large-scan reliability and main-process workload decision
- [ ] Backup, restore, and migration safety
- [ ] IPC input validation and path safety review
- [ ] Logging and unhandled-error reporting
- [ ] Offline/network policy alignment
- [ ] MVP workflow acceptance testing
- [ ] Package build and clean-environment QA
- [ ] User-facing documentation and release notes

### Can follow shortly after release

These are useful improvements, but should not delay the first release if the MVP acceptance criteria remain clear:

- [ ] Full Dashboard recent-activity panel
- [ ] Additional Search filters such as modified date and verification state
- [ ] Filtered search-result export
- [ ] Directory aggregate statistics
- [ ] udisks2 event-driven device watching
- [ ] Background progress and cancellation for export

### Explicitly outside the initial-release gate

- Windows and macOS builds
- Cloud sync
- Backing up original file contents
- Disc writing or burning
- In-app media previews
- Printable QR labels, unless the current release scope is expanded
- Advanced multi-device concurrency beyond the supported configured queue

## P0 - Release Blockers

### P0.1 Automated verification and CI

- [~] Add unit tests for hash modes, glob exclusions, symlink behavior, file-kind classification, scan diffing, and cancellation. Scan-engine coverage now verifies hash modes, exclusions, symlink behavior, file-kind classification, scan errors, and cancellation; database, diffing, and broader integration coverage remain.
- [~] Add database integration tests for migrations, FTS search, tags, collections, backup, restore, and foreign-key behavior. An Electron-runtime runner now verifies migrations, WAL, integrity, FTS trigger synchronization, tags, collections, and foreign-key rejection against the native SQLite ABI; backup/restore and interruption coverage remain.
- [ ] Add IPC tests for malformed payloads and structured error responses.
- [ ] Add renderer tests for the primary registration, scan, search, backup, restore, and Help workflows.
- [~] Add `lint`, `typecheck`, and `test` scripts that fail on errors. `typecheck` and `test` now pass; lint is still unconfigured.
- [ ] Add a CI workflow that runs `npm ci`, dependency audit, lint, typecheck, tests, renderer build, Electron build, and packaging.
- [ ] Keep the lockfile committed and fail CI on new high or critical dependency vulnerabilities, with documented exceptions when necessary.

**Exit evidence:** A clean checkout passes every required command without manual intervention.

### P0.2 Scanning correctness and reliability

- [~] Mark cancelled scans as `incomplete` or otherwise clearly partial, matching FR-2.8 and NFR-2.4. Active and queued cancellation now finalize as `incomplete`; renderer history already surfaces the status. End-to-end manager coverage remains.
- [~] Verify that partial results, removed-file pruning, scan history, and `lastScannedAt` remain consistent after cancellation. Active cancellation now skips unseen-file pruning and leaves scan timestamps unchanged; database integration coverage remains.
- [ ] Decide whether the initial release accepts the current yielding main-process scanner or requires a worker/utility process. The documented NFR requires filesystem scanning and hashing off the Electron UI thread.
- [ ] If keeping the current architecture temporarily, establish measured limits and test responsiveness during large metadata and full-hash scans.
- [ ] Add progress timing that meets the documented update expectation and exposes enough information for long scans.
- [ ] Test permission failures, disappearing files, unreadable files, symlink loops, disconnected media, and hash-read failures.
- [ ] Verify duplicate results distinguish full hashes, quick hashes, and files with no hash.

**Exit evidence:** A large-media test matrix produces correct completed, incomplete, and failed states without freezing or corrupting the application.

### P0.3 Database, backup, restore, and migration safety

- [ ] Create an automatic safety backup before migrations, not only before restore.
- [~] Validate a restore source before replacing the live database: readable SQLite file, expected schema, compatible migration state, and required tables. Integrity, DiscDock schema identity, and supported-version checks are now performed before replacement.
- [~] Restore through a temporary destination and atomic rename rather than copying directly over the active database. The restore now stages and swaps the database file.
- [~] Define rollback behavior if reopening or migrating the restored database fails. The live database is restored from the displaced file when reopening fails; failure-path integration coverage remains.
- [ ] Ensure WAL and SHM sidecars are handled safely for both backup and restore.
- [ ] Provide a clear recovery path to the generated pre-restore backup.
- [ ] Test upgrades from every supported prior schema version, including populated FTS data and user annotations.
- [~] Verify foreign-key enforcement and transactional behavior under interruption or simulated failure. Foreign-key enforcement is now enabled and covered by the integration runner; interruption and rollback simulation remain.
- [ ] Add a database integrity check to diagnostics or recovery tooling.

**Exit evidence:** A corrupted, incompatible, interrupted, and valid restore are each tested, with no loss of the pre-restore catalog.

### P0.4 Security and IPC hardening

- [~] Validate every IPC payload with shared schemas or explicit type guards instead of unchecked casts. A shared validation module now covers settings, search, export, backup, duplicates, collections, tags, custom fields, files, devices, dialogs, and media; sender-origin checks cover the high-risk settings, search, export, backup, and scan operations, while lower-risk handlers remain.
- [~] Validate numeric IDs, enum values, strings, array contents, paths, pagination values, and settings ranges. The selected channels now reject malformed IDs, enums, arrays, ranges, paths, and pagination values; broader channel coverage remains.
- [~] Validate and normalize scan roots before traversal; require an existing directory where appropriate. The scan IPC handler now resolves the path and rejects missing, unreadable, or non-directory roots; broader IPC validation remains.
- [ ] Recheck that file open/reveal paths remain inside the linked media mount after symlink and case-related edge cases.
- [ ] Validate backup/export destinations and selected restore files in the main process, even though the renderer uses native dialogs.
- [~] Validate IPC sender origins and reject unexpected renderer senders. High-risk settings, search, export, backup, and scan operations now accept only the packaged `file://` renderer or the development localhost renderer; remaining handlers need the same guard.
- [ ] Replace the current permissive CSP with the strictest policy compatible with the renderer bundle, documenting any required exceptions.
- [ ] Audit all remote calls and external process invocations, including MusicBrainz, Cover Art Archive, updater services, `lsblk`, `udisksctl`, and `eject`.

**Exit evidence:** A malformed-input and path-traversal test suite passes, and the security checklist is reviewed against the packaged application.

### P0.5 Offline and network policy

- [x] Make network activity opt-in and visible to the user. Audio-CD enrichment is now explicitly controlled in Settings and the UI explains the network behavior.
- [x] Disable automatic update checks by default for v1, or update the product/security documentation to explicitly approve the current behavior. New installations now default automatic update checks to off.
- [x] Make MusicBrainz and Cover Art Archive enrichment optional during audio-CD scans.
- [ ] Ensure offline scanning succeeds without delays or failures caused by metadata lookup timeouts.
- [ ] Document every external endpoint and the data sent to it.
- [ ] Confirm that file names, paths, hashes, and catalog contents never leave the machine.

**Exit evidence:** A network-disabled test run completes the core registration, scan, search, backup, restore, and export workflows.

### P0.6 Logging and failure visibility

- [~] Configure rotating local main-process logs under the documented user-data directory. `electron-log` now writes the main log under the app user-data `logs` directory; rotation and retention still need an explicit QA check.
- [~] Log application startup, shutdown, migrations, scan lifecycle, per-job failures, device detection failures, backup/restore, exports, and updater errors. Startup, Electron-ready, and shutdown events are wired; operation-specific logging remains.
- [x] Add main-process handlers for uncaught exceptions and unhandled promise rejections.
- [x] Add renderer error-boundary handling and a non-blocking user-visible error path.
- [ ] Avoid silently swallowing failures except where the fallback and user impact are documented.
- [ ] Include a support-friendly diagnostics path that reports app version, platform, database schema, and recent error summaries without exposing catalog data unnecessarily.

**Exit evidence:** Simulated failures appear in logs and produce an actionable UI or notification message.

## P1 - MVP Completion and Product Quality

### P1.1 Core workflow acceptance

- [ ] Register media manually with all required fields, including tags and optional metadata.
- [ ] Detect and link removable devices on a supported Linux distribution.
- [ ] Gracefully fall back to manual folder selection when automatic device detection is unavailable.
- [ ] Scan metadata-only and full-hash media, cancel a scan, rescan it, and inspect the diff summary.
- [ ] Search across multiple disconnected media items.
- [ ] Browse cataloged folders while the physical media is disconnected.
- [ ] Open or reveal a file only when the linked media is currently connected and the path is valid.
- [ ] Back up and restore the catalog without losing tags, collections, annotations, scan history, or custom fields.
- [ ] Verify the Help system across all views, including keyboard navigation, resizing, persistence, and reduced-motion behavior.

### P1.2 Dashboard and search coverage

- [ ] Add recent scan activity to the Dashboard.
- [ ] Add a clear attention area for media needing verification, scan errors, incomplete scans, and failed operations.
- [ ] Add Search filters required by FR-3.3: specific media item, size range, modified date range, and scan/verification status.
- [ ] Add filtered search-result export or explicitly remove that promise from the release scope and documentation.
- [ ] Ensure empty states provide actionable guidance for first launch, no media, no devices, no results, and failed scans.

### P1.3 Catalog fidelity and scale

- [ ] Compute and display directory aggregate file counts and sizes.
- [ ] Verify pagination or virtualization for every potentially large table and folder listing.
- [ ] Measure search performance at 500,000 file rows.
- [ ] Measure usability and memory behavior at 1,000 media items and 2,000,000 file rows.
- [ ] Verify FTS indexes are rebuilt or repaired when upgrading existing databases.

### P1.4 Device and optical-media behavior

- [ ] Test mounted USB, external disk, SD card, DVD, Blu-ray, and audio CD scenarios.
- [ ] Test device insertion, removal, replacement, duplicate fingerprints, and stale device links.
- [ ] Test systems without `udisks2`, `lsblk`, audio-CD utilities, or network access.
- [ ] Confirm audio-CD metadata enrichment is optional and that raw TOC cataloging remains useful without it.
- [ ] Verify eject and safe-remove failures provide actionable guidance without claiming success prematurely.

## P1 - Packaging and Distribution QA

- [ ] Confirm `electron-builder` produces valid `.deb` and `.AppImage` artifacts from a clean checkout.
- [ ] Add and verify the application icon referenced by the package configuration.
- [ ] Add and verify the license file referenced by the AppImage configuration.
- [ ] Test `.deb` installation on a current Ubuntu LTS image with `apt install ./package.deb` and `dpkg -i`.
- [ ] Test desktop menu entry, icon, protocol registration, single-instance behavior, and deep links.
- [ ] Test `.AppImage` on a non-Debian distribution with FUSE.
- [ ] Test the documented `--appimage-extract-and-run` fallback without FUSE.
- [ ] Verify correct native-module ABI packaging for `better-sqlite3`.
- [ ] Verify first-run data directories, permissions, migration behavior, uninstall behavior, and retained user data.
- [ ] Decide whether updates are disabled for v1 or fully tested against signed published artifacts.
- [ ] Produce versioned release artifacts and release notes using semantic versioning.

**Exit evidence:** The same artifacts pass the clean-install and launch checklist on the supported test environments.

## P2 - Documentation and Support Readiness

- [ ] Update [README.md](../../README.md) to describe the current product instead of the foundational shell status.
- [ ] Document Linux prerequisites, optional audio-CD utilities, device detection fallback behavior, and offline behavior.
- [ ] Document that DiscDock catalogs metadata and does not back up original file contents.
- [ ] Document backup/restore recovery behavior and where safety backups are stored.
- [ ] Document known limitations and supported package formats.
- [ ] Add a first-run workflow guide or make the in-app empty states sufficient for a new user.
- [ ] Add release notes covering schema migrations, data location, and upgrade expectations.
- [ ] Confirm the Help topics match the final UI and release scope.

## Recommended Execution Order

1. Establish tests, linting, type checking, and CI so later changes have a reliable signal.
2. Fix scan state semantics and database/restore safety before exercising destructive or long-running workflows.
3. Add IPC validation, logging, and error boundaries.
4. Resolve the offline/network policy and decide the v1 updater scope.
5. Complete the remaining MVP Dashboard, Search, export, and directory-stat requirements.
6. Run real-media and failure-mode acceptance tests.
7. Package and test clean artifacts on supported Linux environments.
8. Update documentation, version metadata, and release notes.

## Ready-to-Address Status

The project is ready to begin this checklist now. The first work package should be **P0.1 Automated verification and CI**, followed by **P0.2 Scanning correctness and reliability**. No product decision is required to start those items.

The following decisions should be made before implementation reaches them:

- Whether v1 strictly requires worker-thread scanning or accepts a measured interim limitation.
- Whether automatic update checks remain in v1.
- Whether filtered search export is a release requirement or a documented post-release feature.
- Whether the current audio-CD metadata network enrichment is enabled by default.

Initial release readiness should be declared only when every P0 item is checked, the P1 core workflow acceptance suite passes, and the packaging QA checklist has been completed with recorded evidence.
