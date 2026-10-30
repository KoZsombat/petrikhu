// Server-side Open Graph / title injection for shared links (server/lib/page-meta.ts).
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { DEMO, startTestServer } from '../helpers/server.ts'
import type { TestServer } from '../helpers/server.ts'

let server: TestServer
let metaFor: typeof import('../../server/lib/page-meta.ts').metaFor
let renderIndex: typeof import('../../server/lib/page-meta.ts').renderIndex
const template = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const ORIGIN = 'https://petriknew.zsombor.dev'

before(async () => {
  server = await startTestServer()
  ;({ metaFor, renderIndex } = await import('../../server/lib/page-meta.ts'))
  const reviewer = await server.login(DEMO.reviewer)
  const author = await server.login(DEMO.author)
  const [category] = await server.sql<{ id: string }>("SELECT id FROM terms WHERE kind = 'category' LIMIT 1")
  const saved = await author.post('/api/posts', {
    title: 'Ballagás 2026 "nagy" <nap>',
    content: JSON.stringify([{ id: 'b', type: 'paragraph', runs: [{ text: 'A végzősök búcsúznak az iskolától.' }] }]),
    categoryIds: [category.id],
    command: 'submit',
  })
  const post = (saved.body as { post: { id: string } }).post
  await reviewer.post(`/api/posts/${post.id}/decision`, { decision: 'approve', note: '' })
  await server.sql("UPDATE posts SET featured_image = '/uploads/ballagas.jpg' WHERE id = $1", [post.id])
  await reviewer.post('/api/pages', {
    title: 'Nyílt nap',
    slug: 'nyilt-nap',
    description: 'Gyere el a nyílt napunkra!',
    status: 'publish',
    blocks: [{ component: 'PageTitle', values: { breadcrumb: [], title: 'Nyílt nap' } }],
  })
})
after(() => server.close())

const slugOf = async () => (await server.sql<{ slug: string }>('SELECT slug FROM posts LIMIT 1'))[0].slug

test('news: title, excerpt from the text, featured image, article type', async () => {
  const meta = await metaFor(`/hirek/${await slugOf()}`)
  assert.equal(meta?.title, 'Ballagás 2026 "nagy" <nap>')
  assert.equal(meta?.description, 'A végzősök búcsúznak az iskolától.')
  assert.equal(meta?.image, '/uploads/ballagas.jpg')
  assert.equal(meta?.type, 'article')
  // The legacy /<slug> URL of a news post gets the same.
  assert.equal((await metaFor(`/${await slugOf()}`))?.title, meta?.title)
})

test('Creator page and built-in page', async () => {
  assert.deepEqual(await metaFor('/nyilt-nap'), { title: 'Nyílt nap', description: 'Gyere el a nyílt napunkra!', image: undefined, type: 'website' })
  assert.equal((await metaFor('/bemutatkozas'))?.title, 'Bemutatkozás')
})

test('unknown, unpublished and non-page paths get the defaults', async () => {
  assert.equal(await metaFor('/nincs-ilyen'), null)
  assert.equal(await metaFor('/hirek/nincs-ilyen'), null)
  assert.equal(await metaFor('/'), null)
  assert.equal(await metaFor('/a/b/c'), null)
  assert.equal(await metaFor('/%E0%A4%A'), null)
})

test('renderIndex: escaped tags, absolute URLs, one title', async () => {
  const html = renderIndex(template, await metaFor(`/hirek/${await slugOf()}`), ORIGIN, '/hirek/x')
  assert.match(html, /<title>Ballagás 2026 &quot;nagy&quot; &lt;nap&gt; \| petrik\.hu<\/title>/)
  assert.equal(html.match(/<title>/g)?.length, 1)
  assert.match(html, /<meta property="og:image" content="https:\/\/petriknew\.zsombor\.dev\/uploads\/ballagas\.jpg" \/>/)
  assert.match(html, /<meta property="og:url" content="https:\/\/petriknew\.zsombor\.dev\/hirek\/x" \/>/)
  assert.match(html, /<meta name="twitter:card" content="summary_large_image" \/>/)
  assert.match(html, /<meta name="description" content="A végzősök búcsúznak az iskolától\." \/>/)
  assert.doesNotMatch(html, /<nap>/)
  const fallback = renderIndex(template, null, ORIGIN, '/')
  assert.match(fallback, /<meta property="og:title" content="Petrik Lajos Két Tanítási Nyelvű Technikum" \/>/)
})

test('the built app serves index.html with the tags (only when dist/ exists)', { skip: !existsSync(new URL('../../dist/index.html', import.meta.url)) }, async () => {
  const res = await server.client().get('/nyilt-nap')
  assert.equal(res.status, 200)
  assert.match(res.text, /<meta property="og:title" content="Nyílt nap" \/>/)
  assert.match(res.text, /<div id="root"><\/div>/)
})
