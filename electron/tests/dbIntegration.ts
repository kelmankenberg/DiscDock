import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'discdock-db-integration-'))

const moduleLoader = require('node:module') as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown
}
const originalLoad = moduleLoader._load
moduleLoader._load = (request, parent, isMain) => {
  if (request === 'electron') return { app: { getPath: () => userDataPath } }
  return originalLoad(request, parent, isMain)
}

const { closeDb, CURRENT_SCHEMA_VERSION, getDb } = require('../db') as typeof import('../db')
const { setTagsForMedia, getTagsForMedia } = require('../db/tagRepository') as typeof import('../db/tagRepository')
const { createCollection, addMemberToCollection, getCollectionMembers } = require('../db/collectionRepository') as typeof import('../db/collectionRepository')
const { backupNow, restoreFromBackup } = require('../backup/backupService') as typeof import('../backup/backupService')

async function main(): Promise<void> {
  const db = getDb()
  const migration = db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as { version: number }

  assert.equal(migration.version, CURRENT_SCHEMA_VERSION)
  const journalMode = db.pragma('journal_mode') as { journal_mode: string }[]
  assert.equal(journalMode[0]?.journal_mode, 'wal')
  assert.equal(db.pragma('integrity_check', { simple: true }), 'ok')
  assert.equal(db.pragma('foreign_keys', { simple: true }), 1)

  const media = db.prepare("INSERT INTO media_item (label, media_type) VALUES ('Integration Test', 'other')").run()
  const mediaId = Number(media.lastInsertRowid)
  db.prepare("INSERT INTO file_record (media_item_id, path, name, kind) VALUES (?, ?, ?, 'document')").run(mediaId, 'docs/readme.txt', 'readme.txt')
  assert.ok(db.prepare("SELECT rowid FROM file_record_fts WHERE file_record_fts MATCH 'readme'").get())

  db.prepare('DELETE FROM file_record WHERE media_item_id = ?').run(mediaId)
  assert.equal(db.prepare("SELECT rowid FROM file_record_fts WHERE file_record_fts MATCH 'readme'").get(), undefined)

  assert.deepEqual(setTagsForMedia(mediaId, ['archive', 'work', 'archive']), ['archive', 'work'])
  assert.deepEqual(getTagsForMedia(mediaId), ['archive', 'work'])

  const collection = createCollection({ name: 'Integration Collection', description: null })
  addMemberToCollection(collection.id, mediaId)
  assert.equal(getCollectionMembers(collection.id)[0]?.id, mediaId)
  assert.throws(() => db.prepare('INSERT INTO collection_media_item (collection_id, media_item_id) VALUES (?, ?)').run(collection.id, 999999))

  const backupPath = path.join(userDataPath, 'catalog-backup.sqlite3')
  await backupNow(backupPath)
  db.prepare("INSERT INTO media_item (label, media_type) VALUES ('Only In Current', 'other')").run()
  const restoreResult = await restoreFromBackup(backupPath)
  assert.ok(fs.existsSync(restoreResult.safetyBackupPath))
  assert.equal((getDb().prepare("SELECT COUNT(*) AS count FROM media_item WHERE label = 'Only In Current'").get() as { count: number }).count, 0)
  assert.equal((getDb().prepare('SELECT COUNT(*) AS count FROM media_item').get() as { count: number }).count, 1)

  const invalidBackupPath = path.join(userDataPath, 'invalid.sqlite3')
  fs.writeFileSync(invalidBackupPath, 'not a sqlite database')
  await assert.rejects(() => restoreFromBackup(invalidBackupPath), /not a database|file is not a database/i)
  assert.equal((getDb().prepare('SELECT COUNT(*) AS count FROM media_item').get() as { count: number }).count, 1)
  console.log('Database integration checks passed')
}

void main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    closeDb()
    fs.rmSync(userDataPath, { recursive: true, force: true })
  })
