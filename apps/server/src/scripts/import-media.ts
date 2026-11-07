/**
 * One-time import of a folder of files into the media table, e.g. the old site's files that used to live in
 * server/media-seed:  bun run media:import <folder> [url-prefix=/media]
 * A file at <folder>/wp-content/uploads/a.jpg becomes /media/wp-content/uploads/a.jpg. Existing paths are kept.
 */
import { readdir } from 'node:fs/promises'
import { extname, join, relative, sep } from 'node:path'
import { loadConfig } from '../config.ts'
import { createDb, migrateDb } from '../db/client.ts'
import { putMediaIfMissing } from '../lib/media.ts'

const [folder, prefix = '/media'] = process.argv.slice(2)
if (!folder) {
  console.error('Usage: bun run media:import <folder> [url-prefix=/media]')
  process.exit(1)
}

const config = loadConfig()
await migrateDb(config.databaseUrl)
const { db, sql } = createDb(config.databaseUrl)
let added = 0
let seen = 0
for (const entry of await readdir(folder, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue
  const full = join(entry.parentPath, entry.name)
  const rel = relative(folder, full).split(sep).join('/')
  if (rel.split('/').some((part) => part.startsWith('.')) || !extname(rel)) continue
  seen += 1
  const file = Bun.file(full)
  if (await putMediaIfMissing(db, `${prefix.replace(/\/+$/, '')}/${rel}`, Buffer.from(await file.arrayBuffer()), new Date(file.lastModified))) added += 1
}
console.log(`[media] ${seen} files, ${added} added`)
await sql.end()
