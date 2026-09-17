import { parseMarkdown, replaceBody, stringifyMarkdown, updateFrontmatter } from './frontmatter'

const TICKET = `---
key: TD-12
# keep this comment
title: แก้ login timeout
status: todo
deadline: 2026-09-15
custom_field: keep me
labels: [bug, auth]
---
## Context
body`

describe('frontmatter', () => {
  it('parses data and body, dates stay strings', () => {
    const p = parseMarkdown(TICKET)
    expect(p.error).toBeNull()
    expect(p.data).toMatchObject({ key: 'TD-12', title: 'แก้ login timeout', deadline: '2026-09-15', labels: ['bug', 'auth'] })
    expect(p.body).toBe('## Context\nbody')
  })

  it('handles no frontmatter, BOM, CRLF and empty frontmatter', () => {
    expect(parseMarkdown('# Hi').raw).toBeNull()
    expect(parseMarkdown('﻿---\r\na: 1\r\n---\r\nx').data).toEqual({ a: 1 })
    expect(parseMarkdown('---\n---\nbody')).toMatchObject({ data: {}, body: 'body', error: null })
  })

  it('reports invalid yaml without throwing', () => {
    const p = parseMarkdown('---\na: [unclosed\n---\nbody')
    expect(p.error).not.toBeNull()
    expect(p.body).toBe('body')
    expect(() => updateFrontmatter('---\na: [unclosed\n---\nbody', { a: 1 })).toThrow()
  })

  it('updates keys preserving order, comments, unknown keys and body', () => {
    const out = updateFrontmatter(TICKET, { status: 'in-progress', deadline: undefined, priority: 'high' })
    expect(out).toContain('# keep this comment')
    expect(out).toContain('custom_field: keep me')
    expect(out).not.toContain('deadline')
    expect(out.indexOf('status: in-progress')).toBeLessThan(out.indexOf('custom_field'))
    expect(out).toContain('priority: high')
    expect(out).toContain('labels: [ bug, auth ]')
    expect(out.endsWith('---\n## Context\nbody')).toBe(true)
  })

  it('adds frontmatter to a plain file', () => {
    expect(updateFrontmatter('# Note', { tags: ['a'] })).toBe('---\ntags: [ a ]\n---\n# Note')
    expect(stringifyMarkdown({}, 'x')).toBe('x')
    expect(parseMarkdown(stringifyMarkdown({ title: 'T' }, '---\nnot fm')).data).toEqual({ title: 'T' })
  })

  it('replaces body keeping frontmatter bytes', () => {
    const out = replaceBody(TICKET, 'new body')
    expect(out.startsWith(TICKET.slice(0, TICKET.indexOf('## Context')))).toBe(true)
    expect(out.endsWith('new body')).toBe(true)
    expect(replaceBody('old', 'new')).toBe('new')
  })
})
