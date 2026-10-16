import type { HelpTopic, ViewId } from './types'

export const HELP_TOPICS: Record<ViewId, HelpTopic> = {
  dashboard: {
    id: 'dashboard', title: 'Dashboard',
    overview: 'Review catalog totals, recent scan activity, items needing attention, and removable devices currently connected.',
    features: [
      { name: 'Summary cards', description: 'Track registered media, catalogued files, their total size, and how many items are due for verification.' },
      { name: 'Recent Scan Activity', description: 'Review recent scan status and how many files were added, modified, or removed.' },
      { name: 'Needs Attention', description: 'Jump to media that needs verification or has scan issues.' },
      { name: 'Detected Devices', description: 'View connected removable drives and discs, then register, scan, or safely eject a device.' }
    ],
    tips: ['A catalog is a snapshot, so media does not need to stay connected to remain searchable.', 'Verification is a physical readability check, separate from scanning.', 'Audio CDs are identified from their table of contents rather than a filesystem.'],
    seeAlso: ['media-library', 'settings']
  },
  'media-library': {
    id: 'media-library', title: 'Media Library',
    overview: 'Register physical media and manage the catalog of files stored on it.',
    features: [
      { name: 'Add and edit media', description: 'Create or update a media record with a label, media type, physical location, and notes. Detected devices can fill in device details.' },
      { name: 'Detected media', description: 'A banner appears for unregistered connected devices. Register and scan immediately, or add details first.' },
      { name: 'Scan and cancel', description: 'Start a scan from an item menu, follow progress in the table, or cancel an active scan. Audio CDs have a separate track scan action.' },
      { name: 'Filter and sort', description: 'Narrow the table by container or tag. Select a column heading to sort by label, type, location, tags, notes, status, or last scan.' },
      { name: 'Select and batch actions', description: 'Use row checkboxes, Ctrl-click, or Shift-click to select multiple items, then apply available batch operations.' },
      { name: 'Inline metadata', description: 'Click a location or tag cell to edit it without opening the detail page. Notes appear in the table when present.' },
      { name: 'Item actions', description: 'Open an item menu to edit, scan, play available audio, mark verified, retire, print a label, or delete the media record.' }
    ],
    tips: ['Use a stable physical location such as a shelf and box number so the catalog remains useful when media is offline.', 'Choose a hash mode in Settings before scanning if you want duplicate detection.', 'Retiring keeps a record for reference; deleting removes its catalog data.'],
    seeAlso: ['media-detail', 'duplicates', 'settings']
  },
  'media-detail': {
    id: 'media-detail', title: 'Media Detail',
    overview: 'Inspect a media record, manage its cover and metadata, browse catalogued files, and review scan results.',
    features: [
      { name: 'Overview tab', description: 'Review media status, type, location, capacity, last scan, and last verification. Mark the item verified from this page.' },
      { name: 'Cover image and custom fields', description: 'Add or replace cover art from a file or URL, remove it, and edit custom metadata fields configured in Settings.' },
      { name: 'Browse tab', description: 'Navigate the scanned folder tree and inspect file kind, size, duration, modified date, tags, and notes.' },
      { name: 'File actions and annotations', description: 'Open a file, show it in the file manager, or play catalogued audio. Click a tag or note cell to edit its annotation.' },
      { name: 'Scan History and Errors tabs', description: 'Review scan dates, hash modes, file changes, errors, and paths that could not be catalogued.' }
    ],
    tips: ['A scan updates the catalog snapshot; it does not prove that a disc or drive is physically healthy.', 'Use verification when you need to check that the original media can still be read.', 'Directory size and file counts are calculated from catalogued descendants.'],
    seeAlso: ['media-library', 'dashboard']
  },
  search: {
    id: 'search', title: 'Search',
    overview: 'Find catalogued files across all media, including media that is not currently connected.',
    features: [
      { name: 'Live search', description: 'Search by file name or path. Results update as you type, and the clear button removes the query.' },
      { name: 'Search filters', description: 'Narrow results by media type, file kind, media item, tag, minimum or maximum bytes, modified date, scan status, and verification status.' },
      { name: 'Filter visibility', description: 'Use the sliders button beside the query field to show or hide the filter row without clearing its selections.' },
      { name: 'Results and paging', description: 'Review each file’s name, path, media, kind, and size. Large result sets are loaded in pages.' },
      { name: 'Export results', description: 'Export the current query and filters as a CSV file.' }
    ],
    tips: ['Search the catalog even when the original media is offline; connect it only when you need to open a result.', 'Size filters are in bytes.'],
    seeAlso: ['media-library', 'media-detail']
  },
  duplicates: {
    id: 'duplicates', title: 'Duplicates',
    overview: 'Review files that share a hash and identify space that could be reclaimed.',
    features: [
      { name: 'Duplicate groups', description: 'Each group lists catalogued file paths with matching content hashes, their media, and the number of copies.' },
      { name: 'Reclaimable space', description: 'The summary estimates the space beyond one retained copy of each duplicate group.' },
      { name: 'Hash requirements', description: 'Duplicate reports use hashes created during Quick or Full scans; metadata-only scans do not provide this evidence.' }
    ],
    tips: ['Full SHA-256 hashing gives the strongest duplicate evidence; Quick hashing is faster but compares sampled content.', 'This report does not delete files. Confirm physical copies before removing anything outside DiscDock.'],
    seeAlso: ['settings', 'search']
  },
  collections: {
    id: 'collections', title: 'Collections',
    overview: 'Group media into named sets for projects, trips, archives, or any other organizing scheme.',
    features: [
      { name: 'Create collections', description: 'Create a named collection with an optional description using New Collection.' },
      { name: 'Collection overview', description: 'Select a collection to see its description, member count, file count, and total catalogued size.' },
      { name: 'Manage members', description: 'Add available media to the selected collection or remove a member without deleting its media record.' },
      { name: 'Delete a collection', description: 'Delete the selected grouping. Its media records remain in the Media Library.' }
    ],
    tips: ['Use collections for intentional groups and tags for attributes that cross those groups.', 'Removing a member or deleting a collection does not delete the underlying media.'],
    seeAlso: ['media-library']
  },
  'backup-export': {
    id: 'backup-export', title: 'Backup / Export',
    overview: 'Protect the catalog database and take portable copies of its data.',
    features: [
      { name: 'Database Backup', description: 'Save the complete catalog, including media, files, tags, and scan history, to a portable database file.' },
      { name: 'Restore from Backup', description: 'Validate and restore a selected backup. DiscDock creates a safety backup of the current database before replacing it.' },
      { name: 'Catalog Export', description: 'Export all media or a single media item in CSV or JSON format for spreadsheets or other tools.' },
      { name: 'Operation status', description: 'The page reports when backup, restore, or export is running and shows its result when complete.' }
    ],
    tips: ['Store backups on a different physical device from the catalog database.', 'A backup contains catalog data, not the original files represented by that catalog.', 'Restore replaces the active catalog; keep an independent backup before restoring.'],
    seeAlso: ['settings', 'media-library']
  },
  settings: {
    id: 'settings', title: 'Settings',
    overview: 'Configure scanning, appearance, metadata, verification reminders, notifications, and updates.',
    features: [
      { name: 'Scanning Defaults', description: 'Choose the default hash mode, exclude patterns, whether scans follow symbolic links, and the maximum number of simultaneous scans.' },
      { name: 'Network Enrichment', description: 'Opt in to online audio CD title and cover lookups during scans. Network lookups are off unless enabled.' },
      { name: 'Appearance', description: 'Use the system theme or select light or dark explicitly.' },
      { name: 'Custom Media Types and Fields', description: 'Add or remove media type choices and custom fields available on media detail pages.' },
      { name: 'Notifications and Verification', description: 'Choose scan notifications, verification reminders, and how many months can pass before media is flagged.' },
      { name: 'Updates and Desktop Shortcut', description: 'Control automatic update checks, check or install updates manually, and create or remove a Linux desktop shortcut.' },
      { name: 'Keyboard Shortcuts', description: 'Review shortcuts for opening Search and Settings.' }
    ],
    tips: ['Full hashing reads all file contents and takes longer, but gives the strongest duplicate evidence.', 'Exclude generated folders and caches to keep scans focused.', 'Custom fields are available on individual Media Detail pages.'],
    seeAlso: ['duplicates', 'dashboard', 'backup-export']
  }
}

export const VIEW_IDS = Object.keys(HELP_TOPICS) as ViewId[]