import { linkShortcutEdit, pasteAfterLink } from './link-shortcut'

describe('linkShortcutEdit', () => {
  it('turns "/link <url>" into a markdown link', () => {
    expect(linkShortcutEdit('/link https://jira.corp.local/browse/SSO-12')).toEqual({
      start: 0,
      insert: '[jira.corp.local/browse/SSO-12](https://jira.corp.local/browse/SSO-12)',
    })
    expect(linkShortcutEdit('see /linkexample.com/docs')).toEqual({ start: 4, insert: '[example.com/docs](https://example.com/docs)' })
  })

  it('escapes parentheses so the markdown link stays valid', () => {
    expect(linkShortcutEdit('/link https://en.wikipedia.org/wiki/Foo_(bar)')?.insert).toBe(
      '[en.wikipedia.org/wiki/Foo_(bar)](https://en.wikipedia.org/wiki/Foo_%28bar%29)',
    )
  })

  it('ignores non-shortcuts and invalid URLs', () => {
    expect(linkShortcutEdit('/link')).toBeNull()
    expect(linkShortcutEdit('/link not-a-url')).toBeNull()
    expect(linkShortcutEdit('a/link https://a.com')).toBeNull()
    expect(linkShortcutEdit('https://a.com')).toBeNull()
  })
})

describe('pasteAfterLink', () => {
  it('adds a space between /link and the pasted URL', () => {
    expect(pasteAfterLink('see /link', 'https://a.com')).toBe(' https://a.com')
    expect(pasteAfterLink('/LINK', ' https://a.com\n')).toBe(' https://a.com\n')
  })

  it('leaves other pastes alone', () => {
    expect(pasteAfterLink('/link ', 'https://a.com')).toBe('https://a.com')
    expect(pasteAfterLink('hello', 'https://a.com')).toBe('https://a.com')
    expect(pasteAfterLink('a/link', 'x')).toBe('x')
  })
})
