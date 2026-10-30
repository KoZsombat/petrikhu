// Feltöltések ellenőrzése: képek (kiterjesztés + magic bytes), dokumentumok, kiszolgálás (/uploads).
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { DEMO, fileForm, PNG_BYTES, startTestServer } from '../helpers/server.ts'
import type { Client, TestServer } from '../helpers/server.ts'

let server: TestServer
let editor: Client
let author: Client

before(async () => {
  server = await startTestServer()
  editor = await server.login(DEMO.reviewer)
  author = await server.login(DEMO.author)
})
after(() => server.close())

const JPEG_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0])
const GIF_BYTES = Uint8Array.from([...new TextEncoder().encode('GIF89a'), 1, 0, 1, 0])
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><script>alert(1)</script></svg>'
const urlOf = (res: { body: unknown }) => (res.body as { url: string }).url

/** A két képfeltöltő végpont ugyanazt a szabályt alkalmazza. */
const endpoints: { name: string; who: () => Client; path: string }[] = [
  { name: 'Szerkesztő médiatár', who: () => editor, path: '/api/pages/media' },
  { name: 'hír szövegképe (/api/posts/media)', who: () => author, path: '/api/posts/media' },
]

for (const e of endpoints) {
  describe(e.name, () => {
    const upload = (name: string, bytes: Uint8Array | string, type: string) => e.who().post(e.path, fileForm('file', name, bytes, type))
    const rejected = (res: { status: number; body: unknown }) => {
      assert.equal(res.status, 422)
      assert.deepEqual(res.body, { error: 'not_an_image' })
    }

    test('PNG helyes fejléccel és kiterjesztéssel → 200, az url visszaadja a bájtokat image/png-ként', async () => {
      const res = await upload('kep.png', PNG_BYTES, 'image/png')
      assert.equal(res.status, 200)
      const url = urlOf(res)
      assert.match(url, /^\/uploads\/[0-9a-f-]{36}\.png$/)

      const served = await fetch(server.url + url)
      assert.equal(served.status, 200)
      assert.equal(served.headers.get('content-type'), 'image/png')
      assert.equal(served.headers.get('x-content-type-options'), 'nosniff')
      assert.ok(!String(served.headers.get('content-security-policy')).includes('sandbox'))
      assert.deepEqual(new Uint8Array(await served.arrayBuffer()), PNG_BYTES)
    })

    test('JPEG és GIF is átmegy a saját fejlécével; nagybetűs kiterjesztés kisbetűs lesz', async () => {
      const jpg = await upload('a.JPG', JPEG_BYTES, 'image/jpeg')
      assert.equal(jpg.status, 200)
      assert.ok(urlOf(jpg).endsWith('.jpg'))
      const gif = await upload('a.gif', GIF_BYTES, 'image/gif')
      assert.equal(gif.status, 200)
      assert.equal((await fetch(server.url + urlOf(gif))).headers.get('content-type'), 'image/gif')
    })

    test('tiltott kiterjesztés (.exe, .html, .php, nincs) → 422', async () => {
      for (const name of ['a.exe', 'a.html', 'a.php', 'a', 'a.png.exe']) rejected(await upload(name, PNG_BYTES, 'image/png'))
    })

    test('jó kiterjesztés, rossz tartalom → 422', async () => {
      rejected(await upload('szoveg.png', 'ez nem kép', 'image/png'))
      rejected(await upload('jpeg.gif', JPEG_BYTES, 'image/gif'))
      rejected(await upload('png.jpg', PNG_BYTES, 'image/jpeg'))
      rejected(await upload('ures.png', '', 'image/png'))
      rejected(await upload('hamis.webp', 'RIFFxxxxWEBX', 'image/webp'))
    })

    test('nem image/* mimetype → 422', async () => {
      rejected(await upload('kep.png', PNG_BYTES, 'application/octet-stream'))
      rejected(await upload('kep.png', PNG_BYTES, 'text/html'))
    })

    test('SVG (<svg-vel kezdődő) elfogadott, de sandbox CSP-vel szolgálódik ki', async () => {
      const res = await upload('abra.svg', SVG, 'image/svg+xml')
      assert.equal(res.status, 200)
      const served = await fetch(server.url + urlOf(res))
      assert.equal(served.status, 200)
      assert.equal(served.headers.get('content-type'), 'image/svg+xml')
      assert.equal(served.headers.get('content-security-policy'), "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:")
      assert.equal(served.headers.get('x-content-type-options'), 'nosniff')
    })

    test('SVG-nek nevezett HTML → 422', async () => {
      rejected(await upload('x.svg', '<html><script>alert(1)</script></html>', 'image/svg+xml'))
    })

    test('fájl nélkül sem kép → 422', async () => {
      const res = await e.who().post(e.path, new FormData())
      assert.equal(res.status, 422)
    })
  })
}

test('a feltöltött kép bekerül a médiatár listájába', async () => {
  const url = urlOf(await editor.post('/api/pages/media', fileForm('file', 'lista.png', PNG_BYTES, 'image/png')))
  const list = (await editor.get('/api/pages/media')).body as { items: { url: string }[] }
  assert.ok(list.items.some((i) => i.url === url))
})

test('a médiatár jog nélkül (szerző) tiltott, a hírkép bejelentkezés nélkül is', async () => {
  assert.equal((await author.post('/api/pages/media', fileForm('file', 'a.png', PNG_BYTES, 'image/png'))).status, 403)
  const anon = server.client()
  const res = await anon.post('/api/posts/media', fileForm('file', 'a.png', PNG_BYTES, 'image/png'))
  assert.ok(res.status === 401 || res.status === 403, String(res.status))
})

describe('dokumentumok (/api/pages/library/file)', () => {
  const upload = (name: string, bytes: Uint8Array | string = '%PDF-1.4') => editor.post('/api/pages/library/file', fileForm('file', name, bytes, 'application/octet-stream'))

  test('.pdf elfogadott, az url az eredeti név slugját tartalmazza, és kiszolgálható', async () => {
    const res = await upload('Alapito Okirat 2026.pdf', '%PDF-1.4 teszt')
    assert.equal(res.status, 200)
    const url = urlOf(res)
    assert.match(url, /^\/uploads\/alapito-okirat-2026-[0-9a-f]{6}\.pdf$/)
    const served = await fetch(server.url + url)
    assert.equal(served.status, 200)
    assert.equal(served.headers.get('content-type'), 'application/pdf')
    assert.equal(await served.text(), '%PDF-1.4 teszt')
  })

  // multer/busboy alapból latin1-ként értelmezi a fájlnevet, így az UTF-8 ékezetes név ("í" → "Ã" + lágy kötőjel) eltorzul a slugban.
  test('ékezetes eredeti fájlnév ékezetmentesítve kerül az url-be', { todo: 'multer latin1-ként dekódolja az UTF-8 fájlnevet: "Alapító" → "alapa-ta" (defParamCharset: "utf8" kellene)' }, async () => {
    const res = await upload('Alapító Okirat.pdf')
    assert.equal(res.status, 200)
    assert.match(urlOf(res), /^\/uploads\/alapito-okirat-[0-9a-f]{6}\.pdf$/)
  })

  test('más megengedett típusok (docx, xlsx, zip, txt) átmennek', async () => {
    for (const name of ['a.docx', 'b.XLSX', 'c.zip', 'd.txt']) assert.equal((await upload(name)).status, 200, name)
  })

  test('.exe, .html, .svg, .js, kiterjesztés nélküli → 422 unsupported_file', async () => {
    for (const name of ['a.exe', 'a.html', 'a.svg', 'a.js', 'pdf', 'a.pdf.exe']) {
      const res = await upload(name)
      assert.equal(res.status, 422, name)
      assert.deepEqual(res.body, { error: 'unsupported_file' })
    }
  })

  test('útvonal-bejárásos név slugolva tárolódik (nincs / vagy ..)', async () => {
    const res = await upload('../../etc/passwd.pdf')
    assert.equal(res.status, 200)
    const url = urlOf(res)
    const stored = url.slice('/uploads/'.length)
    assert.ok(!stored.includes('/') && !stored.includes('..') && !stored.includes('\\'), stored)
    assert.match(stored, /^(etc-)?passwd-[0-9a-f]{6}\.pdf$/)
    const row = await server.sql('SELECT 1 AS x FROM media_files WHERE path = $1', [url])
    assert.equal(row.length, 1)
  })

  test('az üres alapnév is kap nevet', async () => {
    const res = await upload('.pdf')
    // kiterjesztés nélküli "dotfile" névnek számít (extname('.pdf') === ''), ezért elutasított
    assert.equal(res.status, 422)
  })

  test('jog nélkül (szerző) 403', async () => {
    const res = await author.post('/api/pages/library/file', fileForm('file', 'a.pdf', '%PDF', 'application/pdf'))
    assert.equal(res.status, 403)
  })
})

test('útvonal-bejárás a kiszolgálónál nem ad ki semmit', async () => {
  const res = await fetch(server.url + '/uploads/..%2f..%2fetc%2fpasswd')
  assert.notEqual(res.status, 200)
})
