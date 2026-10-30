# Petrik oldal-komponensek

Hét tiszta, megjelenítő komponens az al-oldalakhoz. A szerkesztő csak tartalmat ad (props), kinézetet nem.
Import: `import { PageTitle, CardGrid } from "./components"` (barrel: `src/components/index.ts`, a prop-típusok is exportálva).

Közös tulajdonságok: minden gyökérelem kap `data-component` (és ha van változat, `data-variant`) attribútumot,
és fogad `className?: string` propot. A `http`-val kezdődő `href` új lapon nyílik (`rel="noopener noreferrer"`).
A listázó komponensek (CardGrid kivéve `highlight`, RowList, CheckList, LogoGrid) fogadnak `limit?: number` propot: ennyi elemet jelenítenek meg (alapból mindet).
Színek, betűk: `src/index.css` `@theme` blokk (`petrik*` tokenek, `font-display|body|mono`).
Előnézet: `npm run dev`, majd `/components-preview`.

## PageTitle

Minden oldal első eleme: morzsamenü, H1, bevezető, opcionális borítókép (`data-variant="default" | "cover"`).

| Prop | Típus | Megjegyzés |
|---|---|---|
| `breadcrumb` | `{ label; href? }[]` | utolsó elem = aktuális oldal, nincs href |
| `title` | `string` | |
| `intro` | `string?` | |
| `cover` | `{ src; alt }?` | 16:6 borítókép |

```tsx
<PageTitle breadcrumb={[{ label: "Kezdőlap", href: "/" }, { label: "Vegyipar" }]} title="Vegyipar" intro="…" />
```

## CardGrid

Kártyarács, 5 változat a `variant` mezőn.

| Változat | Prop-ok |
|---|---|
| `text` | `columns?: 2\|3\|4` (3), `heading?`, `items: { title, text?, eyebrow?, date?, href?, linkLabel? }[]` |
| `person` | `columns?: 2\|3\|4` (3), `heading?`, `items: { name, role?, room?, phone?, email?, photo? }[]` |
| `stat` | `columns?: 3\|4` (4), `items: { value, label }[]` |
| `news` | `columns?: 3\|4` (3), `items: { title, date, image?: { src, alt }, href }[]` |
| `highlight` | `title?`, `text` |

```tsx
<CardGrid variant="text" columns={2} items={[{ eyebrow: "0091", title: "Vegyipar", href: "/vegyipar" }]} />
```

## RowList

Sorok vonalakkal elválasztva, 3 változat.

| Változat | Prop-ok |
|---|---|
| `fact` | `heading?`, `rows: { label, value }[]` |
| `step` | `heading?`, `rows: { key, text }[]` |
| `news` | `rows: { title, excerpt?, date, category?, image?, href }[]`, `filters?: { label, href, active? }[]`, `pagination?: { current, total, hrefFor(page) }` |

A szűrő és a lapozó sima linkekből áll (nincs JS-állapot).

```tsx
<RowList variant="news" rows={rows} filters={filters} pagination={{ current: 1, total: 5, hrefFor: (p) => `?oldal=${p}` }} />
```

## CheckList

| Prop | Típus | Megjegyzés |
|---|---|---|
| `title` | `string?` | |
| `items` | `string[]` | pipás mondatok |
| `sideTitle`, `sideText` | `string?` | ha van, a második hasáb ez a szöveg; különben a lista tör oszlopokra |

```tsx
<CheckList title="Amit kínálunk" items={["Kéttannyelvű képzés", "Gyakorlat partnereknél"]} />
```

## RichText

Olvasó hasáb (`max-w-[68ch]`). Vagy `html`, vagy `children`.

| Prop | Típus | Megjegyzés |
|---|---|---|
| `html` | `string?` | **előre sanitizált** HTML; itt nincs további szűrés (a szerkesztő oldalán kell tisztítani) |
| `children` | `ReactNode?` | |

```tsx
<RichText html={sanitizedHtml} />
```

## CtaBand

Oldalanként legfeljebb egy, az oldal alján.

| Prop | Típus |
|---|---|
| `title` | `string` |
| `buttonLabel` | `string` |
| `href` | `string` |

```tsx
<CtaBand title="Érdekel a vegyipari képzés?" buttonLabel="Jelentkezés" href="/jelentkezes" />
```

## LogoGrid

Egységes méretű partnercsempék; `src` nélkül az `alt` szöveg látszik helyőrzőként.

| Prop | Típus |
|---|---|
| `label` | `string?` |
| `logos` | `{ alt; src?; href? }[]` |

```tsx
<LogoGrid label="Szakmai partnereink" logos={[{ alt: "EGIS" }, { alt: "Teva", src: "/teva.svg" }]} />
```

## Újabb komponensek

| Komponens | Mire jó | Fő prop-ok |
|---|---|---|
| `Feature` | kép + szöveg két hasábban, váltakozó képoldallal | `title`, `eyebrow?`, `html?`, `image?: { src; alt }`, `imageSide?: "left"\|"right"`, `ctaLabel?`, `ctaHref?` |
| `Accordion` | lenyíló szakaszok (natív `<details>`) | `heading?`, `items: { title; html }[]`, `openFirst?` |
| `VideoEmbed` | YouTube-videó 16:9-ben | `url`, `title?`, `caption?` |
| `Callout` | kiemelt közlemény | `title?`, `html`, `tone?: "info"\|"accent"` |
| `LinkList` | linkek / letölthető dokumentumok két hasábban | `heading?`, `items: { title; href; meta? }[]`, `limit?` |
| `DataTable` | táblázat; mobilon soronkénti kártyák | `heading?`, `columns: string[]`, `rows: { cells: string[] }[]`, `highlightFirst?`, `footnote?`, `limit?`. Cellában a `\n` sortörés, a `[felirat](https://…)` link |
| `Gallery` | képgaléria levágott csempékkel | `heading?`, `columns?: 3\|4`, `images: { src; alt? }[]`, `limit?` |

Az `html` mezők, mint a `RichText`-nél, előre megtisztított HTML-t várnak. A folyó szöveg stílusát a `.petrik-prose` osztály adja (`src/index.css`).
