import { notePathFromSplat, routes } from './routes'

describe('routes', () => {
  it('round-trips note paths', () => {
    for (const path of ['notes/Projects/Login flow.md', 'notes/ประชุม #1.md', 'Inbox.md', 'other/x?.md']) {
      const url = routes.note(path)
      const splat = decodeURIComponent(url.slice('/notes/'.length))
      expect(notePathFromSplat(splat)).toBe(path)
    }
    expect(routes.note('notes/a b.md')).toBe('/notes/a%20b.md')
  })
})
