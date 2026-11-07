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

  // The old /<slug> address of a news post redirects permanently.
  const slug = new URL(page.url()).pathname
  const legacy = await page.request.get(`/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, { maxRedirects: 0 })
  expect(legacy.status(), slug).toBe(301)
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
