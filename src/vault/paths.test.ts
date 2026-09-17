import { basename, dirname, extname, isInside, joinPath, normalizePath, stem } from './paths'

describe('paths', () => {
  it('normalizes separators, dots and slashes', () => {
    expect(normalizePath('/notes\\Projects/./a.md/')).toBe('notes/Projects/a.md')
    expect(normalizePath('notes/x/../a.md')).toBe('notes/a.md')
    expect(() => normalizePath('../outside')).toThrow()
  })

  it('splits names', () => {
    expect(dirname('notes/Projects/Login flow.md')).toBe('notes/Projects')
    expect(basename('notes/Projects/Login flow.md')).toBe('Login flow.md')
    expect(extname('notes/a.MD')).toBe('.md')
    expect(extname('.vaultr')).toBe('')
    expect(stem('notes/บันทึก ประชุม.md')).toBe('บันทึก ประชุม')
    expect(joinPath('notes', '', 'a.md')).toBe('notes/a.md')
  })

  it('checks containment by segment', () => {
    expect(isInside('tickets/TD-1.md', 'tickets')).toBe(true)
    expect(isInside('tickets-old/TD-1.md', 'tickets')).toBe(false)
    expect(isInside('anything', '')).toBe(true)
  })
})
