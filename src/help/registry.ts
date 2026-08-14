import type { HelpTopic, ViewId } from './types'

export const HELP_TOPICS: Record<ViewId, HelpTopic> = {
  dashboard: {
    id: 'dashboard', title: 'Dashboard',
    overview: 'See the size and health of your catalog at a glance, along with removable devices currently connected.',
    features: [
      { name: 'Summary cards', description: 'Total media, catalogued files, catalogued size, and items due for verification.' },
      { name: 'Detected Devices', description: 'Connected drives and discs appear here with actions to register, scan, or eject them.' },
      { name: 'Verification count', description: 'Verification is a physical-integrity reminder. It is separate from scanning and tells you which media should be checked again.' }
    ],
    tips: ['A catalog is a snapshot, so media does not need to stay connected to remain searchable.', 'Audio CDs are identified from their table of contents rather than a filesystem.'],
    seeAlso: ['media-library', 'settings']
  },
  'media-library': {
    id: 'media-library', title: 'Media Library',
    overview: 'Register physical media and manage the catalog of files stored on it.',
    features: [
      { name: 'Add Media', description: 'Create a media record manually or register a detected device before scanning it.' },
      { name: 'Selection and menus', description: 'Click rows to select them; use Ctrl-click and Shift-click for multi-selection. Kebab and context menus expose item actions.' },
      { name: 'Inline metadata', description: 'Edit locations, tags, and notes directly in the table. Filters narrow the list by container or tag.' },
      { name: 'Verification and labels', description: 'The verification badge shows when a physical check is due. Batch actions and label printing operate on selected media.' }
    ],
    tips: ['Use a stable physical location such as a shelf and box number so the catalog remains useful when media is offline.', 'Choose the hash mode in Settings before a scan when duplicate detection matters.'],
    seeAlso: ['media-detail', 'duplicates', 'settings']
  },
  'media-detail': {
    id: 'media-detail', title: 'Media Detail',
    overview: 'Inspect one registered media item, its metadata, and the files found during scans.',
    features: [
      { name: 'Overview', description: 'Review identity, location, notes, cover art, and custom fields.' },
      { name: 'Browse', description: 'Explore catalogued paths, file tags, notes, durations, and actions to open or reveal a file.' },
      { name: 'Scan History and Errors', description: 'Review previous scan results and any paths that could not be catalogued.' }
    ],
    tips: ['A scan updates the catalog snapshot; it does not prove that a disc or drive is physically healthy.', 'Use verification when you need to check that the original media can still be read.'],
    seeAlso: ['media-library', 'dashboard']
  },
  search: {
    id: 'search', title: 'Search',
    overview: 'Find catalogued files across all media, including media that is not currently connected.',
    features: [
      { name: 'Live filtering', description: 'Results update as you type and can be narrowed by media type, file kind, and file tags.' },
      { name: 'Search matching', description: 'Full-text search is used when available, with substring matching as a fallback.' },
      { name: 'Paging', description: 'Large result sets are split into pages so browsing stays responsive.' }
    ],
    tips: ['Search the catalog even when the original media is offline; connect it only when you need to open a result.'],
    seeAlso: ['media-library', 'media-detail']
  },
  duplicates: {
    id: 'duplicates', title: 'Duplicates',
    overview: 'Review files that share a hash and identify space that could be reclaimed.',
    features: [
      { name: 'Duplicate groups', description: 'Files are grouped by matching content hashes and size.' },
      { name: 'Reclaimable space', description: 'The report estimates space beyond the first copy in each group.' },
      { name: 'Filters and deletion', description: 'Narrow groups by media type or file kind. Deletion requires care because the catalog may represent offline originals.' }
    ],
    tips: ['Full SHA-256 hashing gives the strongest duplicate evidence; metadata-only scans cannot find content duplicates.', 'Confirm which physical copy you are deleting before reclaiming space.'],
    seeAlso: ['settings', 'search']
  },
  collections: {
    id: 'collections', title: 'Collections',
    overview: 'Group media into named sets for projects, trips, archives, or any other organizing scheme.',
    features: [
      { name: 'Create collections', description: 'Give a collection a name and optional description.' },
      { name: 'Members', description: 'Add or remove registered media without changing the media records themselves.' },
      { name: 'Collections versus tags', description: 'Collections group media intentionally; tags are lightweight labels that can be applied across items.' }
    ],
    tips: ['Use collections for stable sets and tags for attributes that cross those sets.'],
    seeAlso: ['media-library']
  },
  'backup-export': {
    id: 'backup-export', title: 'Backup / Export',
    overview: 'Protect the catalog database and take portable copies of its data.',
    features: [
      { name: 'Database backup', description: 'Save a complete copy of the DiscDock database for recovery.' },
      { name: 'Restore', description: 'Replace the current database from a backup. DiscDock creates a safety backup first.' },
      { name: 'CSV and JSON export', description: 'Export all records or a selected media item for reporting and portability.' }
    ],
    tips: ['Store backups on a different physical device from the catalog database.', 'A backup contains catalog data, not the original files represented by that catalog.'],
    seeAlso: ['settings', 'media-library']
  },
  settings: {
    id: 'settings', title: 'Settings',
    overview: 'Configure scanning, appearance, metadata, verification reminders, notifications, and updates.',
    features: [
      { name: 'Hash modes', description: 'None is fastest, Quick samples content, and Full computes SHA-256 for the strongest duplicate detection.' },
      { name: 'Scan behavior', description: 'Set exclude patterns, symbolic-link handling, and concurrent scan limits.' },
      { name: 'Custom metadata', description: 'Add media types and fields that fit your collection.' },
      { name: 'Verification and notifications', description: 'Choose the verification threshold and which scan or verification reminders you receive.' },
      { name: 'Appearance and updates', description: 'Choose a theme and control automatic update checks.' }
    ],
    tips: ['Full hashing reads more data and takes longer, but makes duplicate reports more trustworthy.', 'Exclude generated folders and caches to keep scans focused.'],
    seeAlso: ['duplicates', 'dashboard', 'backup-export']
  }
}

export const VIEW_IDS = Object.keys(HELP_TOPICS) as ViewId[]