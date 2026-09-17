import { renderMarkdown } from './render'

const ctx = { resolve: (t: string) => ({ 'Login flow': 'notes/Login flow.md', 'attachments/a.png': 'attachments/a.png' })[t] ?? null }

describe('renderMarkdown', () => {
  it('renders wikilinks, embeds, tags and highlights', () => {
    const html = renderMarkdown('See [[Login flow#Seq|flow]] [[Missing]] ![[attachments/a.png]] #tag ==hi==', ctx)
    expect(html).toContain('<a class="wikilink" data-target="Login flow#Seq" href="#">flow</a>')
    expect(html).toContain('class="wikilink is-unresolved"')
    expect(html).toContain('<img data-vault-src="attachments/a.png"')
    expect(html).toContain('<span class="md-tag" data-tag="tag">#tag</span>')
    expect(html).toContain('<mark>hi</mark>')
  })

  it('escapes raw html and renders task lists and tables', () => {
    const html = renderMarkdown('<script>x</script>\n\n- [x] done\n\n| a | b |\n|---|---|\n| 1 | 2 |', ctx)
    expect(html).not.toContain('<script>')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('<table>')
  })

  it('does not treat headings or code as tags/links', () => {
    const html = renderMarkdown('# Heading\n\n`[[x]] #y`', ctx)
    expect(html).toContain('<h1>Heading</h1>')
    expect(html).not.toContain('wikilink')
    expect(html).not.toContain('md-tag')
  })

  it('renders Obsidian callouts', () => {
    const html = renderMarkdown('> [!warning] Heads up\n> body **text**', ctx)
    expect(html).toContain('<blockquote class="md-callout is-warning">')
    expect(html).toContain('<div class="md-callout-title">Heads up</div>')
    expect(html).toContain('body <strong>text</strong>')
    expect(html).not.toContain('[!warning]')
  })

  it('renders web links as chips with short labels', () => {
    const html = renderMarkdown('[Design doc](https://docs.corp.local/x) and https://www.example.com/a/b and [n](notes/a.md)', ctx)
    expect(html).toContain('class="md-link-chip"')
    expect(html).toMatch(/<a href="https:\/\/docs\.corp\.local\/x" class="md-link-chip"[^>]*><svg[^>]*>.*<\/svg>Design doc<\/a>/)
    expect(html).toContain('>example.com/a/b</a>')
    expect(html).not.toMatch(/href="notes\/a\.md"[^>]*md-link-chip/)
  })
})
