import { extractFacts, frontmatterTags } from './extract'

describe('extractFacts', () => {
  it('finds wikilinks with heading, alias and embeds', () => {
    const { links } = extractFacts('See [[Login flow#Sequence|the flow]] and ![[attachments/a.png]]\n[[TD-12]]')
    expect(links).toEqual([
      { target: 'Login flow', heading: 'Sequence', alias: 'the flow', embed: false, line: 0 },
      { target: 'attachments/a.png', heading: null, alias: null, embed: true, line: 0 },
      { target: 'TD-12', heading: null, alias: null, embed: false, line: 1 },
    ])
  })

  it('ignores links and tags inside code', () => {
    const src = 'a `[[no]] #no`\n```\n[[no]] #no\n```\n~~~js\n#no\n~~~\n[[yes]] #yes'
    const f = extractFacts(src)
    expect(f.links.map((l) => l.target)).toEqual(['yes'])
    expect(f.tags).toEqual(['yes'])
  })

  it('parses tags like Obsidian', () => {
    const f = extractFacts('#sso #incident/2026 #คำถาม #123 foo#bar [x](http://a#frag) [[Note#Head]]')
    expect(f.tags).toEqual(['sso', 'incident/2026', 'คำถาม'])
  })

  it('collects headings and task counts', () => {
    const f = extractFacts('# Title\ntext\n## Sub ##\n- [ ] a\n- [x] b\n1. [X] c\n- [] not a task')
    expect(f.headings).toEqual([
      { level: 1, text: 'Title', line: 0 },
      { level: 2, text: 'Sub', line: 2 },
    ])
    expect(f.tasks).toEqual({ done: 2, total: 3 })
  })

  it('reads frontmatter tags in list or string form', () => {
    expect(frontmatterTags(['#a', 'b'])).toEqual(['a', 'b'])
    expect(frontmatterTags('a, b c')).toEqual(['a', 'b', 'c'])
    expect(frontmatterTags(undefined)).toEqual([])
  })
})
