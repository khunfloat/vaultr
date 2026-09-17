import { slugify } from './attachments'

describe('slugify', () => {
  it('keeps unicode, replaces unsafe characters', () => {
    expect(slugify('ภาพหน้าจอ 2026/09:17 [x]')).toBe('ภาพหน้าจอ-2026-09-17-x')
    expect(slugify('///')).toBe('file')
  })
})
