// The pure functions of shared/pnw: permissions, access, slug, rich text.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CAPABILITY, STATUS } from '../shared/pnw/types.ts'
import type { Capability, Post, PostStatus, RichTextBlock } from '../shared/pnw/types.ts'
import {
  ALL_CAPABILITIES,
  CAPABILITY_DESCRIPTION,
  CAPABILITY_LABEL,
  canUseEditor,
  hasCapability,
  hasNewsPermission,
  isCapability,
  permissionSummary,
} from '../shared/pnw/permissions.ts'
import { canEditWorkflowPost, canViewWorkflowPost } from '../shared/pnw/access.ts'
import { slugify, uniqueSlug } from '../shared/pnw/slug.ts'
import { blockText, documentText, emptyTable, isBlank, isSafeColor, isSafeHref } from '../shared/pnw/richtext.ts'

const user = (id: string, ...permissions: Capability[]) => ({ id, displayName: id, permissions })
const author = user('a', CAPABILITY.SUBMIT_NEWS)
const otherAuthor = user('b', CAPABILITY.SUBMIT_NEWS)
const reviewer = user('r', CAPABILITY.REVIEW_NEWS)
const nobody = user('n')

function post(status: PostStatus, authorId = 'a'): Post {
  return {
    id: 'p',
    slug: 'p',
    title: 'Cím',
    content: [],
    excerpt: '',
    categoryIds: [],
    tagIds: [],
    imagePosition: 'top',
    authorId,
    status,
    createdAt: '2026-01-01T00:00:00.000Z',
    modifiedAt: '2026-01-01T00:00:00.000Z',
    date: '2026-01-01T00:00:00.000Z',
  }
}

/* --- permissions.ts --- */

test('every permission has a label and a description', () => {
  assert.equal(new Set(ALL_CAPABILITIES).size, Object.values(CAPABILITY).length)
  for (const capability of ALL_CAPABILITIES) {
    assert.ok(CAPABILITY_LABEL[capability])
    assert.ok(CAPABILITY_DESCRIPTION[capability])
  }
})

test('isCapability only accepts the known values', () => {
  assert.equal(isCapability('pnw_submit_news'), true)
  assert.equal(isCapability('administrator'), false)
  assert.equal(isCapability(undefined), false)
  assert.equal(isCapability(['pnw_submit_news']), false)
})

test('hasCapability / hasNewsPermission / canUseEditor', () => {
  assert.equal(hasCapability(author, CAPABILITY.SUBMIT_NEWS), true)
  assert.equal(hasCapability(author, CAPABILITY.REVIEW_NEWS), false)
  // The two Szerkesztő rights alone do not let you into the Hírkezelő.
  assert.equal(hasNewsPermission(user('x', CAPABILITY.MANAGE_PAGES, CAPABILITY.MANAGE_LIBRARY)), false)
  assert.equal(hasNewsPermission(user('x', CAPABILITY.VIEW_AUDIT_LOG)), true)
  assert.equal(canUseEditor(user('x', CAPABILITY.MANAGE_LIBRARY)), true)
  assert.equal(canUseEditor(author), false)
})

test('permissionSummary', () => {
  assert.equal(permissionSummary(nobody), 'Nincs jogosultság')
  // The order is that of ALL_CAPABILITIES, not of the stored list.
  assert.equal(
    permissionSummary(user('x', CAPABILITY.REVIEW_NEWS, CAPABILITY.SUBMIT_NEWS)),
    `${CAPABILITY_LABEL[CAPABILITY.SUBMIT_NEWS]} · ${CAPABILITY_LABEL[CAPABILITY.REVIEW_NEWS]}`,
  )
})

/* --- access.ts --- */

test('canEditWorkflowPost: the author only their own draft / returned post', () => {
  assert.equal(canEditWorkflowPost(post(STATUS.DRAFT), author), true)
  assert.equal(canEditWorkflowPost(post(STATUS.REVISION), author), true)
  for (const status of [STATUS.PENDING, STATUS.PUBLISH, STATUS.FUTURE, STATUS.ARCHIVED, STATUS.TRASH]) {
    assert.equal(canEditWorkflowPost(post(status), author), false, status)
  }
})

test('canEditWorkflowPost: never a draft of someone else', () => {
  assert.equal(canEditWorkflowPost(post(STATUS.DRAFT), otherAuthor), false)
  assert.equal(canEditWorkflowPost(post(STATUS.REVISION), otherAuthor), false)
})

test('canEditWorkflowPost: without the submit right, not even own post', () => {
  assert.equal(canEditWorkflowPost(post(STATUS.DRAFT), user('a')), false)
})

test('canEditWorkflowPost: the approver can edit everything', () => {
  for (const status of Object.values(STATUS)) assert.equal(canEditWorkflowPost(post(status, 'z'), reviewer), true)
})

test('canViewWorkflowPost', () => {
  assert.equal(canViewWorkflowPost(post(STATUS.PENDING), author), true)
  assert.equal(canViewWorkflowPost(post(STATUS.DRAFT), otherAuthor), false)
  assert.equal(canViewWorkflowPost(post(STATUS.DRAFT), user('a')), false)
  assert.equal(canViewWorkflowPost(post(STATUS.DRAFT, 'z'), reviewer), true)
  assert.equal(canViewWorkflowPost(post(STATUS.DRAFT), nobody), false)
})

/* --- slug.ts --- */

test('slugify: accents, punctuation, spaces', () => {
  assert.equal(slugify('Árvíztűrő tükörfúrógép'), 'arvizturo-tukorfurogep')
  assert.equal(slugify('  Hello, World!  '), 'hello-world')
  assert.equal(slugify('ŐŰ őű'), 'ou-ou')
  assert.equal(slugify('a__b--c'), 'a-b-c')
  assert.equal(slugify('../../etc/passwd'), 'etc-passwd')
})

test('slugify: "hir" instead of an empty result', () => {
  assert.equal(slugify(''), 'hir')
  assert.equal(slugify('!!!'), 'hir')
})

test('uniqueSlug: appends a number to taken slugs', () => {
  assert.equal(uniqueSlug('Hír', new Set()), 'hir')
  assert.equal(uniqueSlug('Hír', new Set(['hir'])), 'hir-2')
  assert.equal(uniqueSlug('Hír', new Set(['hir', 'hir-2', 'hir-3'])), 'hir-4')
  assert.equal(uniqueSlug('Hír', new Set(['hir-2'])), 'hir')
})

/* --- richtext.ts --- */

const block = (partial: Partial<RichTextBlock>): RichTextBlock => ({ id: 'x', type: 'paragraph', runs: [], ...partial })

test('blockText / documentText', () => {
  assert.equal(blockText(block({ runs: [{ text: 'Egy ' }, { text: 'kettő' }] })), 'Egy kettő')
  const table = emptyTable(2, 2)
  table.table!.rows = [['a', 'b'], ['c', 'd']]
  assert.equal(blockText(table), 'a b c d')
  assert.equal(documentText([block({ runs: [{ text: 'x' }] }), block({ runs: [{ text: 'y' }] })]), 'x\ny')
})

test('isBlank: whitespace is blank, image / gallery / embed is content', () => {
  assert.equal(isBlank([block({ runs: [{ text: '  ' }] })]), true)
  assert.equal(isBlank([]), true)
  assert.equal(isBlank([block({ type: 'image', runs: [] })]), false)
  assert.equal(isBlank([block({ type: 'gallery', runs: [] })]), false)
  assert.equal(isBlank([block({ type: 'embed', runs: [] })]), false)
  assert.equal(isBlank([block({ runs: [{ text: 'szöveg' }] })]), false)
})

test('isSafeHref', () => {
  for (const ok of ['/hirek', 'https://petrik.hu', 'http://x.hu', 'mailto:a@b.hu', 'tel:+36', '//facebook.com/x']) {
    assert.equal(isSafeHref(ok), true, ok)
  }
  for (const bad of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', '//', 'vbscript:x', 'hirek', ' javascript:x']) {
    assert.equal(isSafeHref(bad), false, bad)
  }
})

test('isSafeColor', () => {
  for (const ok of ['#fff', '#a1b2c3', 'rgb(1, 2, 3)', 'rgba(1,2,3,0.5)', 'red']) assert.equal(isSafeColor(ok), true, ok)
  for (const bad of ['red;background:url(x)', 'expression(alert(1))', '#fff"', 'url(x)']) assert.equal(isSafeColor(bad), false, bad)
})

test('canTrashWorkflowPost: the author can trash their own draft, returned post and one already in the trash', async () => {
  const { canTrashWorkflowPost } = await import('../shared/pnw/access.ts')
  for (const status of [STATUS.DRAFT, STATUS.REVISION, STATUS.TRASH]) assert.equal(canTrashWorkflowPost(post(status), author), true, status)
  for (const status of [STATUS.PENDING, STATUS.PUBLISH, STATUS.FUTURE, STATUS.ARCHIVED]) assert.equal(canTrashWorkflowPost(post(status), author), false, status)
  assert.equal(canTrashWorkflowPost(post(STATUS.TRASH), otherAuthor), false)
  assert.equal(canTrashWorkflowPost(post(STATUS.PUBLISH, 'z'), reviewer), true)
})
