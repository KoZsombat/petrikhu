import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const USERS = {
  author: { username: 'mk.vezeto', password: 'PetrikMK2026!' },
  reviewer: { username: 'helyettes', password: 'PetrikHelyettes2026!' },
  admin: { username: 'igazgato', password: 'PetrikIgazgato2026!' },
}

async function login(page: Page, who: keyof typeof USERS) {
  await page.context().clearCookies()
  await page.goto('/admin/')
  await page.getByLabel('Felhasználónév').fill(USERS[who].username)
  await page.getByLabel('Jelszó').fill(USERS[who].password)
  await page.getByRole('button', { name: 'Belépés' }).click()
  await expect(page.getByRole('button', { name: 'Kijelentkezés' })).toBeVisible()
}

test('login: a wrong password is refused, the right one opens the dashboard', async ({ page }) => {
  await page.goto('/admin/')
  await page.getByLabel('Felhasználónév').fill('mk.vezeto')
  await page.getByLabel('Jelszó').fill('rossz-jelszo-123')
  await page.getByRole('button', { name: 'Belépés' }).click()
  await expect(page.getByRole('alert')).toContainText('Hibás felhasználónév vagy jelszó')
  await login(page, 'author')
  await expect(page.getByRole('heading', { name: 'Szia, Kovács Anna!' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Fiókok' })).toHaveCount(0)
})

test('news: write and submit, reject with a message, fix and resubmit, approve, see it on the site', async ({ page }) => {
  const title = `Tavaszi projektnap ${Date.now()}`

  // The author writes the post and submits it.
  await login(page, 'author')
  await page.getByRole('link', { name: 'Új hír', exact: true }).click()
  await page.getByLabel('Cím', { exact: true }).fill(title)
  await page.getByLabel('Kivonat', { exact: true }).fill('Projektnap az egész iskolában.')
  await page.getByRole('textbox', { name: 'Szöveg' }).click()
  await page.keyboard.type('A diákok egész nap projekteken dolgoztak.')
  await page.getByRole('checkbox', { name: 'Hírek', exact: true }).check()
  await page.getByRole('button', { name: 'Beküldés jóváhagyásra' }).click()
  await expect(page.getByText('Jóváhagyásra beküldve.')).toBeVisible()
  await expect(page.getByText('Ezt a hírt most nem szerkesztheted')).toBeVisible()

  // The reviewer sends it back with a message.
  await login(page, 'reviewer')
  await page.getByRole('navigation').getByRole('link', { name: 'Jóváhagyásra vár' }).click()
  await page.getByRole('link', { name: title }).click()
  await page.getByLabel('Üzenet a szerzőnek').fill('Írd bele a dátumot is.')
  await page.getByRole('button', { name: 'Visszaküldés javításra' }).click()
  await expect(page.getByText('Visszaküldve a szerzőnek.')).toBeVisible()

  // The author sees the message, fixes the post and resubmits it.
  await login(page, 'author')
  await page.getByRole('link', { name: title }).click()
  await expect(page.getByText('Írd bele a dátumot is.')).toBeVisible()
  await page.getByRole('textbox', { name: 'Szöveg' }).click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Időpont: április 22.')
  await page.getByRole('button', { name: 'Beküldés jóváhagyásra' }).click()
  await expect(page.getByText('Jóváhagyásra beküldve.')).toBeVisible()

  // The reviewer approves it.
  await login(page, 'reviewer')
  await page.getByRole('navigation').getByRole('link', { name: 'Jóváhagyásra vár' }).click()
  await page.getByRole('link', { name: title }).click()
  await page.getByRole('button', { name: 'Jóváhagyás és publikálás most' }).click()
  await expect(page.getByText('Jóváhagyva és publikálva.')).toBeVisible()

  // It is on the public site: the news list, its own page and the home page.
  await page.goto('/hirek')
  await page.getByRole('link', { name: title }).click()
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  await expect(page.getByText('Időpont: április 22.')).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('heading', { name: title })).toBeVisible()

  // The old /<slug> address of a news post redirects permanently (Next.js's permanentRedirect: 308).
  const slug = new URL(page.url()).pathname
  const legacy = await page.request.get(`/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, { maxRedirects: 0 })
  expect(legacy.status(), slug).toBe(308)
  expect(legacy.headers().location).toContain('/hirek/tavaszi-projektnap-')
})

test('creator: edit a page and see it published', async ({ page }) => {
  const heading = `Elérhetőségeink ${Date.now()}`
  await login(page, 'admin')
  await page.getByRole('link', { name: 'Oldalak' }).click()
  await page.getByRole('link', { name: 'Elérhetőség', exact: true }).click()
  await page.getByRole('button', { name: /Sorlista/ }).click()
  await page.getByLabel('Címsor', { exact: true }).fill(heading)
  await page.getByRole('button', { name: 'Mentés (kint marad)' }).click()
  await expect(page.getByText('Az oldal kint van a webhelyen.')).toBeVisible()
  await page.goto('/elerhetoseg')
  await expect(page.getByRole('heading', { name: heading })).toBeVisible()
})

test('creator: a new page goes live when published', async ({ page }) => {
  const stamp = Date.now()
  const title = `Nyílt nap ${stamp}`
  await login(page, 'admin')
  await page.goto('/admin/oldalak/uj')
  await page.getByLabel('Cím (böngészőfül, keresők)').fill(title)
  await page.getByRole('button', { name: /Oldalcím/ }).click()
  await page.getByLabel('Cím *').fill(title)
  await page.getByRole('button', { name: 'Új elem' }).click()
  await page.getByLabel('Felirat *').fill('Kezdőlap')
  await page.getByRole('button', { name: 'Közzététel' }).click()
  await expect(page.getByText('Az oldal kint van a webhelyen.')).toBeVisible()
  await page.goto(`/nyilt-nap-${stamp}`)
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
})

test('public site: home, a page, English pages and the 404', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: /Több mint 140 éve/ })).toBeVisible()
  await page.goto('/elerhetoseg')
  await expect(page).toHaveTitle('Elérhetőség | petrik.hu')
  await page.getByRole('link', { name: 'English' }).first().click()
  await expect(page).toHaveURL(/\/en\/contact$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  const about = await page.request.get('/about-us', { maxRedirects: 0 })
  expect(about.status()).toBe(301)
  const missing = await page.goto('/nincs-ilyen-oldal')
  expect(missing?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Az oldal nem található' })).toBeVisible()
})

test('preview: unsaved post content opens on the site through the API, only for its author', async ({ page, context }) => {
  await login(page, 'author')
  await page.getByRole('link', { name: 'Új hír', exact: true }).click()
  await page.getByLabel('Cím', { exact: true }).fill('Előnézeti próba')
  await page.getByRole('textbox', { name: 'Szöveg' }).click()
  await page.keyboard.type('Ez még nincs elmentve.')
  const [popup] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Előnézet' }).click()])
  await popup.waitForURL(/\/elonezet\//)
  await expect(popup.getByRole('heading', { level: 1, name: 'Előnézeti próba' })).toBeVisible()
  await expect(popup.getByText('Ez még nincs elmentve.')).toBeVisible()
  await expect(popup.getByRole('note')).toContainText('Előnézet')
  const url = popup.url()
  await context.clearCookies()
  const anonymous = await popup.request.get(url)
  expect(anonymous.status()).toBe(404)
})

test('seo: robots.txt, sitemap.xml, structured data, hreflang and canonical links', async ({ page, request }) => {
  const robots = await (await request.get('/robots.txt')).text()
  for (const line of ['Disallow: /admin', 'Disallow: /api/', 'Disallow: /elonezet/', 'Sitemap: http://localhost:4000/sitemap.xml']) expect(robots).toContain(line)

  const sitemap = await request.get('/sitemap.xml')
  expect(sitemap.headers()['content-type']).toContain('xml')
  const xml = await sitemap.text()
  for (const url of ['/elerhetoseg</loc>', '/en/about-us</loc>', '/hirek/tavaszi-projektnap-', '/dokumentumtar</loc>']) expect(xml).toContain(url)
  expect(xml).toContain('hreflang="en"')

  await page.goto('/')
  const school = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent())!)
  expect(school['@type']).toBe('HighSchool')
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', /\/en$/)

  await page.goto('/elerhetoseg')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'http://localhost:4000/elerhetoseg')
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', /\/en\/contact$/)
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1)
  const crumbs = await page.locator('script[type="application/ld+json"]').allTextContents()
  expect(crumbs.some((text) => JSON.parse(text)['@type'] === 'BreadcrumbList')).toBe(true)

  await page.goto('/hirek?oldal=2')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'http://localhost:4000/hirek?oldal=2')

  await page.goto('/hirek')
  await page.locator('[data-component="newsList"] article a').first().click()
  await page.waitForURL(/\/hirek\/.+/)
  const article = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((text) => JSON.parse(text))
  expect(article.find((data) => data['@type'] === 'NewsArticle')?.headline).toBeTruthy()
})

/** A logged-in API client of its own (another person, in another browser). */
async function apiAs(playwright: typeof import('@playwright/test'), who: keyof typeof USERS) {
  const api = await playwright.request.newContext({ baseURL: 'http://localhost:4000', extraHTTPHeaders: { 'cf-connecting-ip': `198.51.100.${Math.floor(Math.random() * 200) + 1}` } })
  const res = await api.post('/api/auth/login', { data: USERS[who] })
  expect(res.status()).toBe(200)
  return api
}

const postBody = (title: string, extra: Record<string, unknown> = {}) => ({
  title,
  excerpt: '',
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `${title} szövege` }] }] },
  categoryIds: ['hirek'],
  ...extra,
})

test('concurrent edit: the second save gets the conflict dialog; reload shows the other version, overwrite saves mine', async ({ page, playwright }) => {
  const stamp = Date.now()
  const author = await apiAs(playwright, 'author')
  const id = (await (await author.post('/api/posts', { data: postBody(`Ütközés ${stamp}`, { command: 'submit' }) })).json()).post.id

  await login(page, 'reviewer')
  await page.goto(`/admin/hirek/${id}`)
  await page.getByLabel('Cím', { exact: true }).fill(`Ütközés ${stamp} – jóváhagyó`)

  // Meanwhile the admin saves the same post.
  const admin = await apiAs(playwright, 'admin')
  const loaded = (await (await admin.get(`/api/posts/${id}`)).json()).post
  expect((await admin.put(`/api/posts/${id}`, { data: postBody(`Ütközés ${stamp} – admin`, { version: loaded.version }) })).status()).toBe(200)

  await page.getByRole('button', { name: 'Módosítások mentése' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Közben valaki más is mentett' })
  await expect(dialog).toContainText('Szabó Éva mentette közben')
  // Reload: the admin's version replaces mine.
  await dialog.getByRole('button', { name: 'Újratöltés (az enyém elvetése)' }).click()
  await expect(page.getByLabel('Cím', { exact: true })).toHaveValue(`Ütközés ${stamp} – admin`)

  // Again, and this time overwrite.
  const now = (await (await admin.get(`/api/posts/${id}`)).json()).post
  await admin.put(`/api/posts/${id}`, { data: postBody(`Ütközés ${stamp} – admin 2`, { version: now.version }) })
  await page.getByLabel('Cím', { exact: true }).fill(`Ütközés ${stamp} – az enyém`)
  await page.getByRole('button', { name: 'Módosítások mentése' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Felülírás (az enyém mentése)' }).click()
  await expect(page.getByText('Módosítások elmentve.')).toBeVisible()
  expect((await (await admin.get(`/api/posts/${id}`)).json()).post.title).toBe(`Ütközés ${stamp} – az enyém`)
})

test('unschedule: a scheduled post goes back to the review queue', async ({ page, playwright }) => {
  const title = `Időzített ${Date.now()}`
  const author = await apiAs(playwright, 'author')
  const id = (await (await author.post('/api/posts', { data: postBody(title, { command: 'submit' }) })).json()).post.id
  const reviewerApi = await apiAs(playwright, 'reviewer')
  await reviewerApi.post(`/api/posts/${id}/decision`, { data: { decision: 'approve', publishAt: new Date(Date.now() + 86_400_000).toISOString() } })

  await login(page, 'reviewer')
  await page.getByRole('navigation').getByRole('link', { name: 'Időzített' }).click()
  const row = page.getByRole('listitem').filter({ hasText: title })
  await row.getByRole('button', { name: 'Időzítés visszavonása' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Időzítés visszavonása' })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await row.getByRole('button', { name: 'Időzítés visszavonása' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Visszavonás' }).click()
  await expect(page.getByText('időzítés visszavonva, újra jóváhagyásra vár')).toBeVisible()
  await page.getByRole('navigation').getByRole('link', { name: 'Jóváhagyásra vár' }).click()
  await expect(page.getByRole('link', { name: title })).toBeVisible()
})

test('library: removing a document can delete its file from the server too', async ({ page }) => {
  const title = `Tanmenet ${Date.now()}`
  await login(page, 'admin')
  await page.getByRole('link', { name: 'Dokumentumtár' }).click()
  const firstCategory = page.locator('section').first()
  await firstCategory.getByRole('button', { name: 'Dokumentum', exact: true }).click()
  const row = firstCategory.getByRole('listitem').last()
  await row.getByLabel('Dokumentum címe').fill(title)
  await row.locator('input[type=file]').setInputFiles({ name: 'tanmenet.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 e2e') })
  await expect(page.getByText('Feltöltve. Ne felejtsd el menteni.')).toBeVisible()
  const url = await row.getByLabel('Fájl', { exact: true }).inputValue()
  expect(url).toMatch(/^\/uploads\/tanmenet-[A-Za-z0-9_-]{22}\.pdf$/)
  await page.getByRole('button', { name: 'Mentés', exact: true }).click()
  await expect(page.getByText('Dokumentumtár elmentve.')).toBeVisible()
  expect((await page.request.get(url)).status()).toBe(200)

  // While it is in the list the file cannot be deleted from the media library.
  await page.getByRole('link', { name: 'Médiatár' }).click()
  await page.getByRole('tab', { name: 'Dokumentumok' }).click()
  await page.getByRole('row').filter({ hasText: 'tanmenet-' }).first().getByRole('button', { name: 'Törlés' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Végleges törlés' }).click()
  await expect(page.getByText('Nem törölhető, mert használatban van')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Dokumentumtár' }).last()).toBeVisible()

  // Removed from the list, with the file.
  await page.getByRole('navigation').getByRole('link', { name: 'Dokumentumtár' }).click()
  await page.getByRole('listitem').filter({ has: page.getByLabel('Dokumentum címe').and(page.locator(`[value="${title}"]`)) }).getByRole('button', { name: 'Törlés' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Dokumentum eltávolítása a listából' })
  await expect(dialog.getByRole('checkbox', { name: /A fájlt is törlöm/ })).toBeChecked()
  await dialog.getByRole('button', { name: 'Eltávolítás' }).click()
  await expect(page.getByText('Mentéskor ezek a fájlok a szerverről is törlődnek')).toBeVisible()
  await page.getByRole('button', { name: 'Mentés', exact: true }).click()
  await expect(page.getByText('Dokumentumtár elmentve, 1 fájl törölve a szerverről.')).toBeVisible()
  expect((await page.request.get(url)).status()).toBe(404)
})

test('unsaved changes: leaving the editor asks first', async ({ page }) => {
  await login(page, 'admin')
  await page.getByRole('link', { name: 'Menü' }).click()
  await page.getByLabel('Felirat').first().fill('Módosított, nem mentett')
  await page.getByRole('link', { name: 'Áttekintés' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Nem mentett módosítások' })
  await dialog.getByRole('button', { name: 'Maradok' }).click()
  await expect(page.getByLabel('Felirat').first()).toHaveValue('Módosított, nem mentett')
  await page.getByRole('link', { name: 'Áttekintés' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Elvetés és továbblépés' }).click()
  await expect(page.getByRole('heading', { name: /^Szia/ })).toBeVisible()
})

test('rate limits key on the client-IP header Next.js passes on, not on a spoofed X-Forwarded-For', async ({ request }) => {
  const statuses: number[] = []
  for (let i = 0; i < 10; i += 1) {
    const res = await request.post('/api/auth/login', { data: { username: 'nincs.ilyen.e2e', password: 'rossz-jelszo-1' }, headers: { 'cf-connecting-ip': '203.0.113.50', 'x-forwarded-for': `10.0.0.${i}, 1.2.3.4` } })
    statuses.push(res.status())
  }
  expect(statuses.slice(0, 8).every((status) => status === 401)).toBe(true)
  expect(statuses.slice(8)).toEqual([429, 429])
})

test('home page: one h1, and the video loads nothing from YouTube until played', async ({ page }) => {
  const youtube: string[] = []
  page.on('request', (req) => {
    if (/youtube|ytimg|googlevideo/.test(new URL(req.url()).hostname)) youtube.push(req.url())
  })
  await page.goto('/')
  await expect(page.locator('h1')).toHaveCount(1)
  const play = page.getByRole('button', { name: /^Videó lejátszása/ })
  await play.scrollIntoViewIfNeeded()
  expect(youtube).toEqual([])
  await play.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/"]')).toHaveCount(1)
})
