// sanitizeRichHtml: the allowlist filter for the `html` fields of Creator pages.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeRichHtml } from '../server/lib/sanitize.ts'

test('a <script> tag disappears together with its content', () => {
  assert.equal(sanitizeRichHtml('<p>Szia</p><script>alert(1)</script>'), '<p>Szia</p>')
})

test('on* event handlers are dropped', () => {
  const out = sanitizeRichHtml('<p onclick="x()" onmouseover="y()">Szöveg</p><img src="https://a.hu/k.png" onerror="z()">')
  assert.ok(!/on\w+=/i.test(out), out)
  assert.ok(out.includes('<p>Szöveg</p>'))
  assert.ok(out.includes('src="https://a.hu/k.png"'))
})

test('javascript: address in a/href and img/src is dropped', () => {
  const link = sanitizeRichHtml('<a href="javascript:alert(1)">kattints</a>')
  assert.ok(!link.includes('javascript'), link)
  assert.ok(link.includes('kattints'))
  const img = sanitizeRichHtml('<img src="javascript:alert(1)" alt="x">')
  assert.ok(!img.includes('javascript'), img)
})

test('data: image and protocol-relative address do not survive', () => {
  assert.ok(!sanitizeRichHtml('<img src="data:image/png;base64,AAAA">').includes('data:'))
  assert.ok(!sanitizeRichHtml('<img src="//evil.hu/a.png">').includes('evil.hu'))
})

test('a non-YouTube iframe src is dropped (an empty frame remains)', () => {
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

test('a disallowed iframe attribute (onload, srcdoc) is dropped', () => {
  const out = sanitizeRichHtml('<iframe src="https://www.youtube.com/embed/a" onload="x()" srcdoc="<b>"></iframe>')
  assert.ok(out.includes('<iframe'))
  assert.ok(!out.includes('onload') && !out.includes('srcdoc'), out)
})

test('common formatting and links survive', () => {
  const html = '<h2>Cím</h2><p><strong>fet</strong> <em>dőlt</em> <a href="https://petrik.hu/x">link</a> <a href="mailto:a@b.hu">mail</a> <a href="tel:+3611234567">tel</a></p><ul><li>egy</li></ul><table><tbody><tr><td colspan="2">cella</td></tr></tbody></table>'
  assert.equal(sanitizeRichHtml(html), html)
})

test('internal (root-relative) link survives', () => {
  assert.equal(sanitizeRichHtml('<a href="/nyolcadikos">x</a>'), '<a href="/nyolcadikos">x</a>')
})

test('rel=noopener noreferrer is added next to target=_blank', () => {
  const out = sanitizeRichHtml('<a href="https://a.hu" target="_blank">x</a>')
  assert.ok(out.includes('target="_blank"'))
  assert.ok(out.includes('rel="noopener noreferrer"'), out)
})

test('disallowed tags (style, h1, form) and the style attribute are dropped, the text stays', () => {
  const out = sanitizeRichHtml('<style>p{}</style><h1>Nagy</h1><p style="color:red">x</p><form><input></form>')
  assert.ok(!out.includes('style') && !out.includes('<h1') && !out.includes('<form') && !out.includes('<input'), out)
  assert.ok(out.includes('<p>x</p>'))
})

test('empty text stays empty', () => {
  assert.equal(sanitizeRichHtml(''), '')
})
