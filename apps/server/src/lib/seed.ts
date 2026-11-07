/**
 * First-run content. An empty database gets the demo accounts and the categories; the built-in pages
 * (seed/pages.*.json, the old site's content), the menus and the document library are written once, after
 * which the database is the only source of truth (`settings.seeded` records that it happened).
 */
import { and, eq, sql } from 'drizzle-orm'
import { resolve } from 'node:path'
import type { Block } from '@petrik/shared/blocks'
import { blockId } from '@petrik/shared/blocks'
import type { Role } from '@petrik/shared/roles'
import type { Library, Menu } from '@petrik/shared/schemas'
import type { Db } from '../db/client.ts'
import { documents, settings, terms, users } from '../db/schema.ts'
import { searchTextOf } from './documents.ts'
import { convertPageBlocks } from './legacy-content.ts'
import { createUser } from './users.ts'

const SEED_DIR = resolve(import.meta.dir, '../../seed')
const read = <T>(file: string): Promise<T> => Bun.file(resolve(SEED_DIR, file)).json() as Promise<T>

/** The public demo accounts. In production none may keep its demo password (index.ts). */
export const DEMO_USERS: { username: string; displayName: string; role: Role; password: string }[] = [
  { username: 'mk.vezeto', displayName: 'Kovács Anna', role: 'author', password: 'PetrikMK2026!' },
  { username: 'helyettes', displayName: 'Nagy Péter', role: 'reviewer', password: 'PetrikHelyettes2026!' },
  { username: 'igazgato', displayName: 'Szabó Éva', role: 'admin', password: 'PetrikIgazgato2026!' },
]

export type SeedOptions = {
  /** Production: one admin account instead of the demo accounts. */
  production?: boolean
  /** The production admin's username (PNW_ADMIN_USERNAME, default `admin`). */
  adminUsername?: string
}

/**
 * Accounts of an empty database. Development and tests: the demo accounts (with `seedPassword` instead of their
 * public passwords, if given). Production: a single admin with `seedPassword`, who must change it at first login.
 */
export async function seedUsers(db: Db, seedPassword?: string, options: SeedOptions = {}): Promise<void> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(users)
  if (n > 0) return
  if (options.production) {
    if (!seedPassword) throw new Error('PNW_SEED_PASSWORD is required to create the first admin in production')
    await createUser(db, { username: options.adminUsername || 'admin', displayName: 'Adminisztrátor', role: 'admin', password: seedPassword, mustChangePassword: true })
    return
  }
  for (const user of DEMO_USERS) await createUser(db, { ...user, password: seedPassword ?? user.password })
}

export async function seedTerms(db: Db): Promise<void> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(terms)
  if (n > 0) return
  const categories = await read<{ id: string; name: string; parentId: string | null }[]>('categories.json')
  for (const category of categories) await db.insert(terms).values({ id: category.id, kind: 'category', name: category.name, parentId: category.parentId })
}

export const defaultMenu = (locale: 'hu' | 'en') => read<Menu>(`menu.${locale}.json`)
export const defaultLibrary = () => read<Library>('library.json')

export async function getSetting<T>(db: Db, key: string): Promise<T | undefined> {
  return (await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).limit(1))[0]?.value as T | undefined
}

export async function putSetting(db: Db, key: string, value: unknown, userId: string | null = null): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value, updatedById: userId })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date(), updatedById: userId } })
}

/** A stored setting with its version (0 when it is not stored yet) and who saved it last. */
export async function getVersionedSetting<T>(db: Db, key: string): Promise<{ value: T | undefined; version: number; updatedAt: Date | null; updatedById: string | null }> {
  const row = (await db.select().from(settings).where(eq(settings.key, key)).limit(1))[0]
  return row ? { value: row.value as T, version: row.version, updatedAt: row.updatedAt, updatedById: row.updatedById } : { value: undefined, version: 0, updatedAt: null, updatedById: null }
}

/**
 * Saves a setting only if it is still at `expected` (0: not stored yet). Returns the new version, or null when
 * someone else saved in between.
 */
export async function putSettingIfVersion(db: Db, key: string, value: unknown, userId: string | null, expected: number): Promise<number | null> {
  if (expected === 0) {
    const [row] = await db.insert(settings).values({ key, value, updatedById: userId }).onConflictDoNothing().returning({ version: settings.version })
    return row?.version ?? null
  }
  const [row] = await db
    .update(settings)
    .set({ value, updatedAt: new Date(), updatedById: userId })
    .where(and(eq(settings.key, key), eq(settings.version, expected)))
    .returning({ version: settings.version })
  return row?.version ?? null
}

/** Rewrites the English pages' links to the English site where an English version exists. */
function englishLinks(blocks: unknown): unknown {
  const map: Record<string, string | undefined> = { '/': '/en', '/kapcsolat': undefined }
  return JSON.parse(JSON.stringify(blocks), (key, value) => (key === 'href' && typeof value === 'string' && value in map ? map[value] : value))
}

/** The built-in pages, as documents. Pages whose slug is already taken (e.g. by an imported page) are skipped. */
export async function seedPages(db: Db): Promise<{ created: string[]; issues: string[] }> {
  const created: string[] = []
  const issues: string[] = []
  const titles = await read<Record<string, string>>('titles.json')
  const hu = await read<Record<string, unknown[]>>('pages.hu.json')
  const en = await read<Record<string, { translationOf: string; blocks: unknown[] }>>('pages.en.json')

  const insert = async (slug: string, locale: 'hu' | 'en', title: string, blocks: Block[], translationOf: string | null = null) => {
    const description = (blocks.find((b) => b.type === 'pageTitle')?.props as { intro?: string } | undefined)?.intro ?? ''
    const [row] = await db
      .insert(documents)
      .values({ type: 'page', slug, locale, title, description: description.slice(0, 500), blocks, status: 'published', publishedAt: new Date(), translationOf, searchText: searchTextOf(title, blocks) })
      .onConflictDoNothing()
      .returning({ id: documents.id })
    if (row) created.push(`${locale}:${slug}`)
    return row?.id
  }

  const huIds = new Map<string, string>()
  for (const [slug, raw] of Object.entries(hu)) {
    const { blocks, issues: problems } = convertPageBlocks(raw)
    problems.forEach((p) => issues.push(`${slug}: ${p.component} #${p.index}: ${p.message}`))
    // The news page lists the live posts (the rows in pages.json were placeholders).
    const final = slug === 'hirek' ? blocks.map((b) => (b.type === 'newsList' ? { ...b, props: { ...b.props, items: undefined, limit: undefined, paginate: true } } : b)) : blocks
    const id = await insert(slug, 'hu', titles[slug] ?? slug, final)
    if (id) huIds.set(slug, id)
  }
  const libraryBlocks: Block[] = [{ id: blockId(), type: 'documentLibrary', props: { eyebrow: 'Petrik Lajos Két Tanítási Nyelvű Technikum', title: 'Dokumentumtár' } }]
  await insert('dokumentumtar', 'hu', titles.dokumentumtar ?? 'Dokumentumtár', libraryBlocks)

  for (const [slug, page] of Object.entries(en)) {
    const { blocks, issues: problems } = convertPageBlocks(englishLinks(page.blocks))
    problems.forEach((p) => issues.push(`en/${slug}: ${p.component} #${p.index}: ${p.message}`))
    const original = huIds.get(page.translationOf) ?? (await db.select({ id: documents.id }).from(documents).where(sql`type = 'page' AND locale = 'hu' AND slug = ${page.translationOf}`))[0]?.id
    await insert(slug, 'en', titles[`en:${slug}`] ?? slug, blocks, original ?? null)
  }
  return { created, issues }
}

/** Everything a fresh database needs; safe to call on every start. */
export async function seed(db: Db, seedPassword?: string, options: SeedOptions = {}): Promise<void> {
  await seedUsers(db, seedPassword, options)
  await seedTerms(db)
  if (await getSetting(db, 'seeded')) return
  const { created, issues } = await seedPages(db)
  for (const locale of ['hu', 'en'] as const) if (!(await getSetting(db, `menu.${locale}`))) await putSetting(db, `menu.${locale}`, await defaultMenu(locale))
  if (!(await getSetting(db, 'library'))) await putSetting(db, 'library', await defaultLibrary())
  await putSetting(db, 'seeded', { at: new Date().toISOString(), pages: created.length })
  if (created.length) console.log(`[petrik] seeded ${created.length} pages`)
  for (const issue of issues) console.warn(`[petrik] seed: ${issue}`)
}
