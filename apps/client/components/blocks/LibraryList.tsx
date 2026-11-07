'use client'
import { useState } from 'react'
import type { Library } from '@petrik/shared/schemas'

const fold = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
/** File type from the extension (PDF, DOC…), for the badge. */
const fileType = (file: string) => (/\.([a-z0-9]+)$/i.exec(file)?.[1] ?? 'fájl').slice(0, 4).toUpperCase()

type Labels = { search: string; documents: string; categories: string; download: string; protected: string; noResults: string }

/** The searchable list (the only interactive part of the document library). */
export function LibraryList({ library, labels }: { library: Library; labels: Labels }) {
  const [q, setQ] = useState('')
  const needle = fold(q.trim())
  const categories = library.categories
    .map((c) => ({ ...c, docs: c.docs.filter((d) => !needle || fold(d.title).includes(needle)) }))
    .filter((c) => c.docs.length > 0)
  const total = categories.reduce((n, c) => n + c.docs.length, 0)

  return (
    <>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={q}
          placeholder={labels.search}
          aria-label={labels.search}
          onChange={(e) => setQ(e.target.value)}
          className="block w-full max-w-xl rounded-md border border-petrikline bg-petrikcard px-4 py-2.5 text-[15px] focus:border-petrikaccent focus:outline-none focus:ring-2 focus:ring-petrikaccent/25"
        />
        <span className="font-mono text-xs uppercase tracking-[0.15em] text-petriksoft">
          {total} {labels.documents}
        </span>
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-[240px_minmax(0,1fr)] md:gap-14">
        <nav aria-label={labels.categories} className="md:sticky md:top-28 md:self-start">
          <p className="petrik-eyebrow mb-3">{labels.categories}</p>
          <ul className="flex flex-wrap gap-2 md:flex-col md:gap-0.5">
            {categories.map((c) => (
              <li key={c.slug}>
                <a
                  href={`#${c.slug}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-petriklinesoft bg-petrikcard px-3 py-1.5 text-sm hover:border-petrikaccent hover:bg-petriktint md:border-transparent md:bg-transparent"
                >
                  <span>{c.title}</span>
                  <span className="font-mono text-xs text-petrikfaint">{c.docs.length}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-10">
          {categories.map((category) => (
            <section key={category.slug} id={category.slug} className="scroll-mt-28">
              <h2 className="mb-4 border-b border-petrikline pb-2 font-display text-2xl font-bold">{category.title}</h2>
              <ul className="grid gap-2.5">
                {category.docs.map((doc) => (
                  <li key={doc.slug}>
                    {doc.file ? (
                      <a
                        href={doc.file}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-4 rounded-lg border border-petrikline bg-petrikcard px-4 py-3.5 transition-colors hover:border-petrikaccent hover:bg-petriktint"
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-petriktint font-mono text-[11px] font-medium text-petrikaccentdark group-hover:bg-petrikcard">
                          {fileType(doc.file)}
                        </span>
                        <span className="min-w-0 flex-1 font-semibold leading-snug text-petrikink">{doc.title}</span>
                        <span className="font-mono text-xs uppercase tracking-[0.15em] text-petrikaccentdark">{labels.download} ↓</span>
                      </a>
                    ) : (
                      <div className="flex items-center gap-4 rounded-lg border border-petriklinesoft bg-petrikcard px-4 py-3.5 text-petriksoft">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-petrikcream font-mono text-[11px]">🔒</span>
                        <span className="min-w-0 flex-1 leading-snug">{doc.title}</span>
                        <span className="font-mono text-xs uppercase tracking-[0.15em]">{labels.protected}</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {categories.length === 0 && <p className="text-sm text-petriksoft">{labels.noResults}</p>}
        </div>
      </div>
    </>
  )
}
