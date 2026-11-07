/**
 * UI strings of the public site, by stable key (`nav.contact`). hu.json is the reference; en.json must have
 * the same keys (tests check it). Content (pages, posts) is not translated here: documents carry a locale.
 */
import hu from './i18n/hu.json' with { type: 'json' }
import en from './i18n/en.json' with { type: 'json' }

export type Locale = 'hu' | 'en'

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>
}[keyof T & string]

export type MessageKey = Leaves<typeof hu>

export const MESSAGES: Record<Locale, unknown> = { hu, en }

function lookup(tree: unknown, key: string): string | undefined {
  let node: unknown = tree
  for (const part of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[part]
  return typeof node === 'string' ? node : undefined
}

/** The string for `key` in `locale` (Hungarian when English is missing), with `{name}` placeholders filled. */
export function translate(locale: Locale, key: MessageKey, values: Record<string, string | number> = {}): string {
  const text = lookup(MESSAGES[locale], key) ?? lookup(MESSAGES.hu, key) ?? key
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`))
}

export function translator(locale: Locale) {
  return (key: MessageKey, values?: Record<string, string | number>) => translate(locale, key, values)
}

/** Every key of a message tree (for the completeness test). */
export function messageKeys(tree: unknown, prefix = ''): string[] {
  return Object.entries(tree as Record<string, unknown>).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : messageKeys(value, `${prefix}${key}.`),
  )
}
