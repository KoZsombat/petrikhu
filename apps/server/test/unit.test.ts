import { describe, expect, test } from 'bun:test'
import { BLOCK_SCHEMAS, BLOCK_TYPES, blocksSchema } from '@petrik/shared/blocks'
import { MESSAGES, messageKeys, translate } from '@petrik/shared/i18n'
import { isEmail, isEmbedSrc, isImageSrc, isSafeColor, isSafeHref, youtubeId } from '@petrik/shared/links'
import { CAPABILITIES, ROLES, ROLE_CAPABILITIES, can, smallestRoleCovering } from '@petrik/shared/roles'
import { menuSchema } from '@petrik/shared/schemas'
import { fold, isReservedSlug, slugify, uniqueSlug } from '@petrik/shared/slug'
import { firstImage, isEmptyDoc, plainText } from '@petrik/shared/tiptap'
import { canEditPost, canTrashPost, canViewPost } from '@petrik/shared/workflow'
import { limitFor, DEFAULT_BODY_BYTES, DOCUMENT_BODY_BYTES, UPLOAD_BODY_BYTES } from '../src/lib/limits.ts'
import { htmlToTiptap } from '../src/lib/html-to-tiptap.ts'
import { convertPageBlocks, runsToTiptap } from '../src/lib/legacy-content.ts'
import { searchTextOf } from '../src/lib/documents.ts'

describe('roles', () => {
  test('admin holds every capability, inactive none; every role is listed', () => {
    expect([...ROLE_CAPABILITIES.admin].sort()).toEqual([...CAPABILITIES].sort())
    expect(ROLE_CAPABILITIES.inactive).toEqual([])
    expect(Object.keys(ROLE_CAPABILITIES).sort()).toEqual([...ROLES].sort())
  })
  test('can() checks capabilities, unknown roles hold nothing', () => {
    expect(can({ role: 'reviewer' }, 'news.review')).toBe(true)
    expect(can({ role: 'editor' }, 'news.review')).toBe(false)
    expect(can({ role: 'hacker' }, 'news.write')).toBe(false)
    expect(can(null, 'news.write')).toBe(false)
  })
  test('smallestRoleCovering', () => {
    expect(smallestRoleCovering([])).toBe('inactive')
    expect(smallestRoleCovering(['news.write'])).toBe('author')
    expect(smallestRoleCovering(['news.write', 'terms.create'])).toBe('reviewer')
    expect(smallestRoleCovering(['pages.manage', 'library.manage'])).toBe('editor')
    expect(smallestRoleCovering(['pages.manage', 'news.review'])).toBe('admin')
    expect(smallestRoleCovering(['users.manage'])).toBe('admin')
  })
})

describe('workflow access', () => {
  const author = { id: 'a', role: 'author' }
  const reviewer = { id: 'r', role: 'reviewer' }
  test('the author edits only their own draft; never someone else’s; not after submission', () => {
    expect(canEditPost({ authorId: 'a', status: 'draft' }, author)).toBe(true)
    expect(canEditPost({ authorId: 'b', status: 'draft' }, author)).toBe(false)
    expect(canEditPost({ authorId: 'a', status: 'in_review' }, author)).toBe(false)
    expect(canEditPost({ authorId: 'a', status: 'draft' }, { id: 'a', role: 'editor' })).toBe(false)
  })
  test('the reviewer edits drafts and posts in review; published needs news.manage', () => {
    expect(canEditPost({ authorId: 'x', status: 'in_review' }, reviewer)).toBe(true)
    expect(canEditPost({ authorId: 'x', status: 'published' }, reviewer)).toBe(true)
    expect(canEditPost({ authorId: 'x', status: 'archived' }, reviewer)).toBe(false)
  })
  test('trash and view', () => {
    expect(canTrashPost({ authorId: 'a', status: 'draft' }, author)).toBe(true)
    expect(canTrashPost({ authorId: 'a', status: 'trash' }, author)).toBe(true)
    expect(canTrashPost({ authorId: 'a', status: 'in_review' }, author)).toBe(false)
    expect(canViewPost({ authorId: 'b', status: 'published' }, author)).toBe(false)
    expect(canViewPost({ authorId: 'b', status: 'draft' }, reviewer)).toBe(true)
  })
})

describe('slugs and links', () => {
  test('slugify / uniqueSlug / fold', () => {
    expect(slugify('Árvíztűrő Tükörfúrógép!  2026')).toBe('arvizturo-tukorfurogep-2026')
    expect(slugify('!!!')).toBe('hir')
    expect(uniqueSlug('Hír', new Set(['hir', 'hir-2']))).toBe('hir-3')
    expect(fold('ÉRETTSÉGI')).toBe('erettsegi')
    expect(isReservedSlug('admin')).toBe(true)
  })
  test('isSafeHref / isSafeColor / isEmbedSrc / youtubeId', () => {
    for (const ok of ['/hirek', 'https://x.hu', 'mailto:a@b.hu', 'tel:+36 1 234']) expect(isSafeHref(ok)).toBe(true)
    for (const bad of ['javascript:alert(1)', '//evil.com', 'data:text/html,x', 'vbscript:x']) expect(isSafeHref(bad)).toBe(false)
  })
  test('isSafeHref / isImageSrc refuse paths a browser reads as another host', () => {
    for (const bad of ['/\\evil.com', '/\\/evil.com', '/evil.com\\', '/a\\b/c', '//evil.com/x', '/\t/evil.com', '/\n/evil.com', '/x\u0000y']) {
      expect(isSafeHref(bad)).toBe(false)
      expect(isImageSrc(bad)).toBe(false)
    }
    // A backslash after the first segment, a query or a fragment is harmless.
    for (const ok of ['/', '/hirek/a\\b', '/kereses?q=a\\b', '/oldal#a\\b', '/hirek?kategoria=Esti munkarend']) expect(isSafeHref(ok)).toBe(true)
  })
  test('isEmail and the card e-mail field', () => {
    for (const ok of ['titkarsag@petrik.hu', 'dr.szabo.marianna@petrik.hu', 'lelkiero@yahoo.com']) expect(isEmail(ok)).toBe(true)
    for (const bad of ['', 'titkarsag', 'a@b', 'a b@petrik.hu', 'x@petrik.hu?subject=hi', 'javascript:alert(1)@x.hu']) expect(isEmail(bad)).toBe(false)
    const card = (email: string) => blocksSchema.safeParse([{ id: 'b1', type: 'cards', props: { variant: 'person', columns: 3, items: [{ name: 'Kiss Anna', email }] } }]).success
    expect(card('kiss.anna@petrik.hu')).toBe(true)
    expect(card('')).toBe(true)
    expect(card('kiss.anna')).toBe(false)
  })
  test('menu links use the same rules', () => {
    const menu = (href: string) => menuSchema.safeParse([{ label: 'X', href }]).success
    expect(menu('/hirek')).toBe(true)
    expect(menu('https://petrik.hu')).toBe(true)
    expect(menu('/\\evil.com')).toBe(false)
    expect(menu('//evil.com')).toBe(false)
    expect(isSafeColor('#2b8272')).toBe(true)
    expect(isSafeColor('red; background:url(x)')).toBe(false)
    expect(isEmbedSrc('https://www.youtube.com/embed/x')).toBe(true)
    expect(isEmbedSrc('http://www.youtube.com/embed/x')).toBe(false)
    expect(youtubeId('https://www.youtube.com/watch?v=NnanAwvV8FI')).toBe('NnanAwvV8FI')
  })
})

test('every request body limit: small by default, large on document saves, room for one file on uploads', () => {
  expect(limitFor('POST', '/api/terms')).toBe(DEFAULT_BODY_BYTES)
  expect(limitFor('POST', '/api/auth/login')).toBe(DEFAULT_BODY_BYTES)
  expect(limitFor('POST', '/api/posts/00000000-0000-0000-0000-000000000000/decision')).toBe(DEFAULT_BODY_BYTES)
  expect(limitFor('PUT', '/api/pages/00000000-0000-0000-0000-000000000000')).toBe(DOCUMENT_BODY_BYTES)
  expect(limitFor('POST', '/api/posts')).toBe(DOCUMENT_BODY_BYTES)
  expect(limitFor('POST', '/api/media')).toBe(UPLOAD_BODY_BYTES)
  expect(limitFor('PUT', '/api/users/x')).toBe(DEFAULT_BODY_BYTES)
})

test('i18n: en.json has exactly the keys of hu.json', () => {
  expect(messageKeys(MESSAGES.en).sort()).toEqual(messageKeys(MESSAGES.hu).sort())
  expect(translate('hu', 'common.photoOf', { name: 'Kiss Anna' })).toBe('Kiss Anna fényképe')
})

describe('TipTap helpers', () => {
  test('plainText, isEmptyDoc, firstImage', () => {
    const doc = { type: 'doc' as const, content: [{ type: 'paragraph' as const, content: [{ type: 'text' as const, text: 'Szia' }, { type: 'hardBreak' as const }, { type: 'text' as const, text: 'világ' }] }] }
    expect(plainText(doc)).toBe('Szia világ')
    expect(isEmptyDoc({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '  ' }] }] })).toBe(true)
    expect(isEmptyDoc({ type: 'doc', content: [{ type: 'image', attrs: { src: '/uploads/a.png' } }] })).toBe(false)
    expect(firstImage({ type: 'doc', content: [{ type: 'gallery', attrs: { items: [{ src: '/media/a.jpg', alt: '' }] } }] })).toBe('/media/a.jpg')
  })
  test('search text folds the title and every text in the blocks', () => {
    expect(searchTextOf('Érettségi', [{ id: 'a', type: 'richText', props: { content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Írásbeli VIZSGA' }] }] } } }])).toBe('erettsegi\nirasbeli vizsga')
  })
})

describe('legacy conversion', () => {
  test('old HTML → TipTap: headings, marks, links, lists, images; scripts and unsafe links dropped', () => {
    const doc = htmlToTiptap('<h2>Cím</h2><p>A <strong>vastag</strong> <a href="https://x.hu" target="_blank">link</a><br>sor <a href="javascript:x">rossz</a></p><ul><li>egy</li><li><em>kettő</em></li></ul><script>alert(1)</script><p><img src="/media/a.jpg" alt="kép"></p>')
    expect(doc.content.map((n) => n.type)).toEqual(['heading', 'paragraph', 'bulletList', 'image'])
    expect(JSON.stringify(doc)).not.toContain('javascript')
    expect(JSON.stringify(doc)).not.toContain('alert')
    expect(plainText(doc)).toContain('A vastag link sor rossz')
  })
  test('old blocks-and-runs post → TipTap, valid against the schema', () => {
    const doc = runsToTiptap([
      { type: 'heading', level: 3, runs: [{ text: 'Alcím' }] },
      { type: 'paragraph', align: 'center', runs: [{ text: 'a\nb', bold: true, href: '/hirek', color: '#2b8272' }] },
      { type: 'numbered-list', runs: [{ text: '1' }] },
      { type: 'numbered-list', runs: [{ text: '2' }] },
      { type: 'gallery', gallery: [{ src: '/media/a.jpg', alt: 'a' }], runs: [{ text: '' }] },
      { type: 'embed', embed: { src: 'https://evil.example/x' }, runs: [{ text: '' }] },
    ])
    expect(doc.content.map((n) => n.type)).toEqual(['heading', 'paragraph', 'orderedList', 'gallery'])
    expect(blocksSchema.safeParse([{ id: 'x', type: 'richText', props: { content: doc } }]).success).toBe(true)
  })
  test('every built-in page converts without issues and matches the block schemas', async () => {
    const pages = await Bun.file(new URL('../seed/pages.hu.json', import.meta.url)).json()
    for (const [slug, blocks] of Object.entries(pages)) {
      const result = convertPageBlocks(blocks)
      expect({ slug, issues: result.issues }).toEqual({ slug, issues: [] })
      expect(blocksSchema.safeParse(result.blocks).success).toBe(true)
    }
    expect(BLOCK_TYPES.every((type) => BLOCK_SCHEMAS[type])).toBe(true)
  })
})
