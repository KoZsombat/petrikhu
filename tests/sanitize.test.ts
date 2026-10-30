// sanitizeRichHtml: a Creator-oldalak `html` mezőinek fehérlistás szűrője.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeRichHtml } from '../server/lib/sanitize.ts'

test('a <script> címke tartalmával együtt eltűnik', () => {
  assert.equal(sanitizeRichHtml('<p>Szia</p><script>alert(1)</script>'), '<p>Szia</p>')
})

test('az on* eseménykezelők kiesnek', () => {
  const out = sanitizeRichHtml('<p onclick="x()" onmouseover="y()">Szöveg</p><img src="https://a.hu/k.png" onerror="z()">')
  assert.ok(!/on\w+=/i.test(out), out)
  assert.ok(out.includes('<p>Szöveg</p>'))
  assert.ok(out.includes('src="https://a.hu/k.png"'))
})

test('javascript: cím az a/href-ben és az img/src-ben kiesik', () => {
  const link = sanitizeRichHtml('<a href="javascript:alert(1)">kattints</a>')
  assert.ok(!link.includes('javascript'), link)
  assert.ok(link.includes('kattints'))
  const img = sanitizeRichHtml('<img src="javascript:alert(1)" alt="x">')
  assert.ok(!img.includes('javascript'), img)
})

test('data: kép és protokoll-relatív cím nem marad', () => {
  assert.ok(!sanitizeRichHtml('<img src="data:image/png;base64,AAAA">').includes('data:'))
  assert.ok(!sanitizeRichHtml('<img src="//evil.hu/a.png">').includes('evil.hu'))
})

test('nem YouTube iframe src-je kiesik (üres keret marad)', () => {
  const out = sanitizeRichHtml('<iframe src="https://evil.example/x"></iframe><p>után</p>')
  assert.ok(!out.includes('src'), out)
  assert.ok(!out.includes('evil.example'))
  assert.ok(out.includes('<p>után</p>'))
})

test('YouTube iframe megmarad', () => {
  for (const host of ['www.youtube.com', 'www.youtube-nocookie.com']) {
    const out = sanitizeRichHtml(`<iframe src="https://${host}/embed/abc123" title="Videó" allowfullscreen></iframe>`)
    assert.ok(out.includes('<iframe'), out)
    assert.ok(out.includes(`https://${host}/embed/abc123`), out)
  }
})

test('iframe nem engedett attribútuma (onload, srcdoc) kiesik', () => {
  const out = sanitizeRichHtml('<iframe src="https://www.youtube.com/embed/a" onload="x()" srcdoc="<b>"></iframe>')
  assert.ok(out.includes('<iframe'))
  assert.ok(!out.includes('onload') && !out.includes('srcdoc'), out)
})

test('a szokásos formázás és a hivatkozások megmaradnak', () => {
  const html = '<h2>Cím</h2><p><strong>fet</strong> <em>dőlt</em> <a href="https://petrik.hu/x">link</a> <a href="mailto:a@b.hu">mail</a> <a href="tel:+3611234567">tel</a></p><ul><li>egy</li></ul><table><tbody><tr><td colspan="2">cella</td></tr></tbody></table>'
  assert.equal(sanitizeRichHtml(html), html)
})

test('belső (gyökér-relatív) hivatkozás megmarad', () => {
  assert.equal(sanitizeRichHtml('<a href="/nyolcadikos">x</a>'), '<a href="/nyolcadikos">x</a>')
})

test('target=_blank mellé rel=noopener noreferrer kerül', () => {
  const out = sanitizeRichHtml('<a href="https://a.hu" target="_blank">x</a>')
  assert.ok(out.includes('target="_blank"'))
  assert.ok(out.includes('rel="noopener noreferrer"'), out)
})

test('nem engedett címke (style, h1, form) és style attribútum kiesik, a szöveg marad', () => {
  const out = sanitizeRichHtml('<style>p{}</style><h1>Nagy</h1><p style="color:red">x</p><form><input></form>')
  assert.ok(!out.includes('style') && !out.includes('<h1') && !out.includes('<form') && !out.includes('<input'), out)
  assert.ok(out.includes('<p>x</p>'))
})

test('üres szöveg üres marad', () => {
  assert.equal(sanitizeRichHtml(''), '')
})
