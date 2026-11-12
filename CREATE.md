# CREATE.md — building pages for the public site

How the Astro site is put together, which component to reach for, and the styling rules. Follow this and a small
prompt ("make an admissions page with a hero, four facts and a FAQ") is enough to add a page that matches the rest
of the site.

The site lives in `apps/web`. Its content is **static**: every page is written in this repository. Only **news
posts**, **teachers** and the **document library** come from the API (`apps/api`).

---

## 1. Golden rules

1. **Use the tokens, never raw colours.** `bg-petrikcream`, `text-petrikink`, `border-petriklinesoft`, … New hex
   values are not allowed (the one exception is the hero's `#1B2420`, inherited from the old site's photo overlay).
2. **Two typefaces only.**
   - `font-display` — Newsreader, for headings and large numbers.
   - `font-body` — Archivo, for running copy, UI and every small label.
   Labels keep the old hierarchy without a third family: Archivo `font-semibold uppercase` with
   `tracking-[0.1em]–[0.18em]`; dates and counters use `tabular-nums`. The `petrik-eyebrow` utility is the standard
   small green label.
3. **One container width.** Content sits in `Container` (max `1240px`, `px-5` mobile / `px-10` desktop). Never
   invent a second page width. Long-form text is capped by `.petrik-prose` (~66–72 characters per line).
4. **Global section rhythm.** Every `<section>` under `<main>` gets the same `padding-block: 1.5rem` (`2rem` from
   `md`) from `globals.css`. Never put `py-*` on a section again. Do not add vertical margins between sections.
   Never add a heading-only `RichTextSection` before an `Accordion`/`CardGrid`/`DocumentGrid`/`AwardsShowcase`;
   pass the `heading` prop instead.
5. **Only two section backgrounds.** A `<section>` may use `bg-petrikcream` or `bg-petrikbg` only; the hero is the one
   documented exception. Apply this directly; do not introduce another section background token.
6. **One card contract.** Page cards use `rounded-xl border border-petrikline bg-petrikcard`; hover may change the
   border, add a restrained shadow, or translate by 0.5. Do not mix `rounded-lg` panels, heavy shadows or random
   card chrome.
7. **One `h1` per page.** It comes from `PageHero` (static pages) or the article header (`/hirek/[slug]`). All
   other headings start at `h2` (`SectionHeading`).
8. **Static by default.** Content pages use `export const prerender = true` and contain their copy in the page
   file (or in a component's props). They must not import `lib/api`.
9. **Only news, teachers, documents, post categories and media are data.** `/`, `/hirek`, `/hirek/[slug]`,
   `/tanari-kar`, `/kereses`, `/dokumentumtar` and `/en` read from the API. Everything else is checked into the
   repository.
10. **Images are in `public/`.** Site assets: `/img/...` (hero, logos, partners), `/fonts/...`, `/media/...`
   (documents). Database images are absolute URLs or start with `/uploads/`.
11. **Accessibility is not optional.** Links are real `<a href>`, buttons are `<button type="button">`, images get
   `alt` (decorative ones `alt=""`), and icons get `aria-hidden="true"`.

---

## 2. Design tokens

Defined in `src/styles/theme.css` (`@theme`), consumed as normal Tailwind utilities.

| Token | Value | Use |
| --- | --- | --- |
| `petrikbg` | `#F7F4EC` | page background (landing bands) |
| `petrikcream` | `#FBFAF6` | default body / header background |
| `petrikcard` | `#FFFFFF` | cards, panels |
| `petrikink` | `#16211D` | main text, dark bands, footer |
| `petriksoft` | `#48524B` | secondary text |
| `petrikfaint` | `#7A8279` | tertiary text, table labels |
| `petrikaccent` | `#2B8272` | primary green (buttons, tags, active nav) |
| `petrikaccentdark` | `#1D5D51` | hover, links, eyebrows |
| `petriktint` | `#EEF4EA` | tinted backgrounds (callouts, chips) |
| `petrikpale` | `#85C1B6` | decorative pale band |
| `petriklight` | `#B1D258` | highlight green (hero accents) |
| `petrikline` | `rgba(22,33,29,.14)` | visible borders |
| `petriklinesoft` | `rgba(22,33,29,.08)` | card borders, dividers |

Typeface variables: `font-display`, `font-body`. Fonts are self-hosted in `public/fonts` with Latin +
Latin-Extended subsets (ő, ű) and `font-display: swap`. There is deliberately no third family.

---

## 3. Page anatomy

A static page is four things:

```astro
---
// 1. imports
import Layout from "../../layouts/Layout.astro";
import PageHero from "../../components/ui/PageHero.astro";
import RichTextSection from "../../components/ui/RichTextSection.astro";

// 2. static rendering
export const prerender = true;
---

<!-- 3. frame + hero -->
<Layout locale="hu" title="Page title" description="One-sentence summary." canonicalPath="/page-slug">
  <PageHero
    breadcrumb={[{ label: "Kezdőlap", href: "/" }, { label: "Page title" }]}
    title="Page title"
    intro="Optional lead paragraph, one or two sentences."
  />

  <!-- 4. sections, in order -->
  <RichTextSection html={"<p>Body copy…</p>"} />
</Layout>
```

### `Layout` props

| Prop | Type | Notes |
| --- | --- | --- |
| `locale` | `"hu" \| "en"` | sets `<html lang>`, menu, footer and chrome strings |
| `title` | `string?` | rendered as `Title \| petrik.hu`; omit on the home page |
| `description` | `string?` | `<meta name="description">` and Open Graph description |
| `noindex` | `boolean?` | search page, 404, previews |
| `canonicalPath` | `string?` | absolute path for the canonical URL (defaults to `Astro.url.pathname`) |
| `jsonLd` | `Record<string, unknown>?` | optional schema.org object, rendered as JSON-LD |

### Static vs. dynamic

| Page | `prerender` | Source |
| --- | --- | --- |
| all content pages (`/bemutatkozas`, `/nyolcadikos`, …) | `true` | file content |
| `/`, `/hirek`, `/hirek/[slug]`, `/tanari-kar`, `/kereses`, `/dokumentumtar`, `/en` | `false` | API |

When adding a page: create `src/pages/<slug>.astro` (or `src/pages/en/<slug>.astro`), set `prerender = true`, and
add the route to `MENUS` / `footerColumns` / `upperLinks` in `src/lib/site.ts` if it belongs in the chrome. For a
translated page add the slug pair to `TRANSLATIONS` in `src/lib/i18n.ts` so the language switch works.

---

## 4. Component catalog

Everything is in `src/components`. Import what you need; a page only ships the components it uses.

### Frame (used by `Layout`)

| Component | What it does | Main props |
| --- | --- | --- |
| `layout/UpperHeader.astro` | Dark green top bar: phone, email, socials, utility links, language switch | `locale` |
| `layout/SiteHeader.astro` | Sticky cream header: logo, desktop dropdown menu, mobile menu | `locale` |
| `layout/SiteFooter.astro` | Dark footer: logo, address, three link columns, contact, socials, legal line | `locale` |
| `layout/LanguageSwitch.astro` | `HU | EN`; picks the counterpart page or the other home page | `locale`, `tone?`, `class?` |
| `layout/Logo.astro` | The school logo at 1x/2x | `alt`, `class?` |
| `icons.tsx` | Facebook/Instagram outline and solid marks (lucide has no brands) | `size?`, SVG props |

The menu labels and links live in `src/lib/site.ts` (`MENUS`); the strings in `src/lib/i18n.ts`.

### Structure

| Component | What it does | Main props |
| --- | --- | --- |
| `ui/Container.astro` | The 1240 px content column | `class?` |
| `ui/Section.astro` | Standard vertical rhythm + container around arbitrary content | `class?`, `containerClass?`, `id?` |
| `ui/SectionHeading.astro` | `h2` in Newsreader, optional eyebrow above | `title`, `eyebrow?` |
| `ui/PageHero.astro` | Breadcrumb + `h1` + intro + optional cover image. First block of every content page | `breadcrumb?`, `title`, `intro?`, `cover?` |
| `ui/EmptyState.astro` | Dashed "nothing here" panel | `title?`, `text?` |

Section components (`Prose`, `Accordion`, `LinkList`, `DataTable`, …) already include their own `py-14 md:py-16`
and `Container`; do **not** wrap them in another `Section` unless you need a different background.

### Content blocks

| Component | Use it for | Props |
| --- | --- | --- |
| `ui/RichTextSection.astro` | A standalone rich-text block: standard section padding + container + `.petrik-prose`. Use it for top-level HTML content | `html`, `class?` |
| `ui/Prose.astro` | The prose typography itself. Use inside a block that already has a container (Feature, Callout, Accordion) | `html`, `variant?` (`default`/`bare`/`post`), `class?` |
| `ui/FeatureSection.astro` | Image + text two-column highlight, image left or right, optional CTA | `title`, `html?`, `eyebrow?`, `image?`, `imageSide?`, `ctaLabel?`, `ctaHref?` |
| `ui/Callout.astro` | Notice box: `info` (tinted), `accent` (solid green), `highlight` (slim tinted bar with eyebrow) | `html`, `title?`, `tone?` |
| `ui/CardGrid.astro` | Grid of text cards or person cards (initials fall back when no photo) | `variant` (`text`/`person`), `items`, `columns?`, `heading?`, `limit?` |
| `ui/StatGrid.astro` | Big number + uppercase label (stats) | `items` (`{value,label}`), `columns?` |
| `ui/Timeline.astro` | Numbered/dated rows with a tabular-nums key on the left (history, steps) | `heading?`, `rows` (`{key,text}`) |
| `ui/FactList.astro` | Definition rows: label left, value right (contact details, data) | `heading?`, `rows` (`{label,value}`) |
| `ui/CheckList.astro` | Check-marked list, one or two columns | `title?`, `items`, `limit?` |
| `ui/LinkList.astro` | Two-column linked cards with meta line (documents, links) | `heading?`, `items` (`{title,meta?,href?}`), `limit?` |
| `ui/LogoGrid.astro` | Grid of partner logos/alt-text tiles | `label?`, `logos` (`{src?,alt,href?}`), `limit?` |
| `ui/DataTable.astro` | Responsive table: real table on desktop, labelled cards on mobile | `columns`, `rows` (`{cells[]}`), `heading?`, `footnote?`, `limit?` |
| `ui/DocumentLibrary.astro` | Searchable document library with category nav (documents come from the API) | `title`, `library`, `eyebrow?` |
| `ui/Accordion.astro` | Native `<details>` FAQ / collapsible sections, no JS | `items` (`{title,html}`), `heading?`, `openFirst?`, `class?`, `id?` |
| `ui/DocumentGrid.astro` | Download cards with file-type badge, icon, hover lift | `items` (`{title,href,meta?}`), `heading?`, `intro?`, `id?`, `class?` |
| `ui/InPageNav.astro` | Sticky in-page section nav with scrollspy | `items` (`{id,label}`) |
| `ui/StatCards.astro` | Icon metric cards; value/label right-aligned | `items` (`{value,label,detail?,icon?}`), `heading?`, `eyebrow?` |
| `ui/HistoryRail.astro` | Sticky-heading timeline rail with scroll reveal | `rows` (`{key,text}`), `heading?`, `intro?`, `eyebrow?` |
| `ui/AwardsShowcase.astro` | Award cards with date, range badge and wide entries | `rows` (`{cells:[date,text]}`), `heading?`, `intro?` |
| `ui/FurtherReading.astro` | Linked external reading card(s) | `items` (`{title,meta?,href?}`), `heading?`, `intro?` |
| `ui/VideoGrid.astro` | Two-up responsive YouTube grid | `items` (`{heading,url,title?,caption?}`) |
| `ui/VideoEmbed.astro` | 16:9 YouTube embed (privacy-friendly domain), plain link otherwise | `url`, `heading?`, `title?`, `caption?` |
| `ui/CtaBand.astro` | Full-width tinted band with a heading and one button | `title`, `buttonLabel`, `href` |
| `ui/ButtonLink.astro` | Green solid or underlined text link | `href`, `variant?` (`solid`/`text`) |
| `ui/DateTag.astro` | Green date tag (Archivo, tabular-nums) | `date`, `class?` |
| `ui/SearchBox.astro` | GET search form (no JavaScript) | `value?`, `placeholder?`, `action?`, `name?` |
| `ui/Picture.astro` | Plain `<img>` with `loading` control | `src`, `alt?`, `class?`, `loading?` |

### News (data-driven)

| Component | Use it for | Props |
| --- | --- | --- |
| `ui/NewsCard.astro` | Home-page news card with image, date tag, title, excerpt | `item` (`NewsRowData`), `detailsLabel?` |
| `ui/NewsRow.astro` | One horizontal news row (image/stripes, date, title, excerpt, category) | `row` |
| `ui/NewsRows.astro` | Section with a list of rows, optional category chips and pagination | `rows`, `filters?`, `pagination?`, `filtersLabel?`, `emptyLabel?` |
| `ui/Pagination.astro` | Numbered pager with gaps | `current`, `total`, `hrefFor` |
| `ui/PostContent.astro` | Plain-text database post → paragraphs (blank line = paragraph) | `content` |

`NewsRowData` (from `src/lib/news.ts`): `{ title, excerpt?, date, category?, image?, href }`. Use
`toNewsRow(post, locale)` to turn an API post into a row.

### Teachers (data-driven)

| Component | Use it for | Props |
| --- | --- | --- |
| `teachers/TeacherCard.astro` | One teacher: photo or initials, name, role, room, email | `teacher` |
| `teachers/TeacherGrid.astro` | Responsive 4-column teacher grid | `teachers` |

### Home page

| Component | Use it for | Props |
| --- | --- | --- |
| `home/Hero.astro` | Full-bleed photo hero, animated headline, two CTAs, three counters, molecule canvas | `locale` |
| `home/LatestNews.astro` | Four latest news cards + "all news" link; hidden when there are no posts | `locale`, `posts` |
| `home/Programmes.astro` | Three programme cards (chemistry, environment, IT) | `locale` |
| `home/Reasons.astro` | Six reasons with icons | `locale` |
| `home/Projects.astro` | Ten project/partner logos | `locale` |
| `home/Introduction.astro` | Video + about text + counters | `locale` |
| `home/Partners.astro` | Six industry partner logos | `locale` |

All home strings come from `home.*` keys in `src/lib/i18n.ts`. The hero's count-up and molecule canvas are
progressive enhancement: numbers and content are already in the HTML without JavaScript.

---

## 5. Data from the API

`src/lib/api.ts`:

```ts
getPosts({ limit?, offset?, category?, q? }) // → { posts: PostSummary[], total: number }
getPost(slug)                                 // → Post | null
getTeachers()                                 // → Teacher[]
getDocuments()                                // → { categories: LibraryCategory[] }
```

- Only call these from `prerender = false` pages.
- `PostSummary`: `id, title, slug, excerpt, category, image, publishedAt`.
- `Post` adds `content` (plain text).
- `Teacher`: `id, name, role, email, room, photo`.
- `LibraryCategory`: `{ slug, title, docs: [{ slug, title, file, protected? }] }`. Documents with `file: null`
  render as protected/archived tiles; `file` values are URLs under `/media/...` or absolute.
- The base URL is `API_INTERNAL_URL` (server-side), default `http://localhost:3001`.
- `?kategoria=` filters by the exact category name; `?q=` searches title and content; `?oldal=` pages.

Example (`src/pages/hirek/index.astro`):

```astro
const { posts, total } = await getPosts({ limit: 10, offset: 0, category });
const rows = posts.map((post) => toNewsRow(post));
```

Never fetch the API from a static page, and never fetch from the browser — the site renders on the server.

---

## 6. Adding a page, step by step

1. Decide the route and language: `src/pages/<slug>.astro` (HU) or `src/pages/en/<slug>.astro` (EN).
2. Copy the skeleton from section 3. Set `prerender = true`, `title`, `description`, `canonicalPath`.
3. Start with `PageHero` (breadcrumb matching the menu).
4. Add sections in reading order, one component per idea:
   - intro/lead → `RichTextSection` (or `Prose` inside another block)
   - highlight → `FeatureSection` or `Callout`
   - lists → `CardGrid`, `CheckList`, `Timeline`, `FactList`
   - documents/links → `LinkList`
   - long structured data → `DataTable`
   - FAQ → `Accordion`
   - closing action → `CtaBand`
5. Add the page to `MENUS` (and `footerColumns` if useful) in `src/lib/site.ts`. Menu links are exact paths;
   translated pages go into `TRANSLATIONS` in `src/lib/i18n.ts`.
6. Run:

   ```sh
   bun run --cwd apps/web typecheck
   bun run --cwd apps/web build
   ```

7. Open the built site and check desktop + mobile, focus states, and that only one `h1` exists.

---

## 7. Styling recipes

A text card (`CardGrid variant="text"` or a bespoke one):

```html
<article class="relative rounded-lg border border-petriklinesoft bg-petrikcard p-[22px]">
  <p class="petrik-eyebrow mb-2">Eyebrow</p>
  <h3 class="font-display text-[17px] font-bold leading-snug">Title</h3>
  <p class="mt-2 text-sm leading-[1.55] text-petriksoft">Body.</p>
</article>
```

Buttons:

```html
<a class="inline-block rounded-md bg-petrikaccent px-5 py-[11px] text-[15px] font-semibold text-petrikcard hover:bg-petrikaccentdark">Primary</a>
<a class="text-sm font-semibold text-petrikaccentdark border-b-2 border-petrikaccentdark">Text link</a>
```

Chips / tags: `rounded-full bg-petriktint px-2.5 py-0.5 text-petrikaccentdark` (small caps, tabular-nums for dates).

Cards hover: `transition-colors hover:border-petrikaccent hover:bg-petriktint` for link rows;
`motion-safe:transition-shadow hover:shadow-md` for raised cards.

Avoid: new font sizes outside the scale, `text-justify`, centred long paragraphs, gradients other than the hero's
existing glow, and shadows on more than one level of nesting at a time.

---

## 8. Assets

| Path | Contents |
| --- | --- |
| `public/img/hero-*.{avif,webp,jpg}` | home hero, responsive widths 640/1280/1920 |
| `public/img/logo-{208,416}.png` | school logo (1x/2x) |
| `public/img/partners/*.{png,webp}` | project and industry logos |
| `public/fonts/*.woff2` | Archivo, Newsreader (two families only) |
| `public/media/wp-content/uploads/...` | documents carried over from the old site |
| `public/favicon-32.png`, `public/icon-192.png`, `public/apple-touch-icon.png` | icons |

Use `Picture.astro` for simple images. Content that still references `/media/...` images (legacy uploads that were
never in the repository) degrades gracefully: `FeatureSection`, `CardGrid` and `LogoGrid` ignore missing media and
fall back to layout/initials/alt text.

---

## 9. What not to do

- Do not re-introduce a page renderer or a JSON block schema. Pages are Astro files with explicit components.
- Do not put news or teacher data in static content; they belong to the API.
- Do not hardcode labels in page files for chrome that already exists (menus, footer, language switch, search
  placeholders) — use `src/lib/i18n.ts`.
- Do not add a second styling system (CSS-in-JS, another utility framework). Tailwind + the tokens above only.
- Do not copy the old site's broken `/media/...` image URLs into new content.
