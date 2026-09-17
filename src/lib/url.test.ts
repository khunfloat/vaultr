import { isWebUrl, linkLabel, normalizeUrl } from './url'

describe('normalizeUrl', () => {
  it('adds https to bare hosts and keeps explicit schemes', () => {
    expect(normalizeUrl('example.com/docs')).toBe('https://example.com/docs')
    expect(normalizeUrl(' http://jira.corp.local/browse/SSO-12 ')).toBe('http://jira.corp.local/browse/SSO-12')
    expect(normalizeUrl('http://wiki/page')).toBe('http://wiki/page')
    expect(normalizeUrl('localhost:3000')).toBe('https://localhost:3000/')
  })

  it('rejects unsafe or invalid input', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeUrl('file:///C:/x')).toBeNull()
    expect(normalizeUrl('not a url')).toBeNull()
    expect(normalizeUrl('wiki')).toBeNull()
    expect(normalizeUrl('')).toBeNull()
  })
})

describe('linkLabel', () => {
  it('shortens to host and path', () => {
    expect(linkLabel('https://www.example.com/')).toBe('example.com')
    expect(linkLabel('https://jira.corp.local/browse/SSO-12?focus=1')).toBe('jira.corp.local/browse/SSO-12?focus=1')
    expect(linkLabel('https://th.wikipedia.org/wiki/%E0%B8%81')).toBe('th.wikipedia.org/wiki/ก')
    expect(linkLabel(`https://a.com/${'x'.repeat(80)}`)).toHaveLength(48)
  })

  it('detects web urls', () => {
    expect(isWebUrl('https://a.com')).toBe(true)
    expect(isWebUrl('notes/a.md')).toBe(false)
  })
})
