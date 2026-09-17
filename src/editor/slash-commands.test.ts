import { SLASH_COMMANDS, slashEdit } from './slash-commands'

const kind = (id: string) => {
  const k = SLASH_COMMANDS.find((c) => c.id === id)!.kind
  if (k.type === 'action') throw new Error('action')
  return k
}

/** Apply a slash command where `|` marks the end of `/query`, returning the doc with `|` at the new cursor. */
function run(docWithCursor: string, id: string) {
  const to = docWithCursor.indexOf('|')
  const doc = docWithCursor.replace('|', '')
  const from = doc.lastIndexOf('/', to)
  const e = slashEdit(doc, from, to, kind(id), new Date('2026-09-17T10:00:00'))
  const out = doc.slice(0, e.from) + e.insert + doc.slice(e.to)
  const cursor = e.from + e.cursor
  return out.slice(0, cursor) + '|' + out.slice(cursor)
}

describe('slashEdit', () => {
  it('turns an empty line into a block prefix', () => {
    expect(run('a\n/quo|\nb', 'quote')).toBe('a\n> |\nb')
    expect(run('/|', 'h2')).toBe('## |')
    expect(run('  /todo|', 'todo')).toBe('  - [ ] |')
  })

  it('converts an existing block marker instead of stacking', () => {
    expect(run('/quote|- item', 'quote')).toBe('> |item')
    expect(run('/text|## Title', 'text')).toBe('|Title')
  })

  it('converts a marker-only line typed as "> /cmd"', () => {
    expect(run('> /code|', 'code')).toBe('```\n|\n```')
    expect(run('- /h1|', 'h1')).toBe('# |')
  })

  it('starts a new line when invoked mid-line', () => {
    expect(run('hello /quote|', 'quote')).toBe('hello \n> |')
  })

  it('inserts fenced code with the cursor inside', () => {
    expect(run('/code|', 'code')).toBe('```\n|\n```')
    expect(run('x /code| tail', 'code')).toBe('x \n```\n|\n```\n tail')
  })

  it('inserts table, divider and callout', () => {
    expect(run('/table|', 'table')).toBe('| |Column 1 | Column 2 |\n| --- | --- |\n|  |  |')
    expect(run('/div|', 'divider')).toBe('---\n|')
    expect(run('/call|', 'callout')).toBe('> [!note]\n> |')
  })

  it('link inserts the /link shortcut to paste into', () => {
    expect(run('see /li|', 'weblink')).toBe('see /link |')
  })

  it('inserts inline date and highlight', () => {
    expect(run('Due /today|', 'date')).toBe('Due 2026-09-17|')
    expect(run('a /hi|', 'highlight')).toBe('a ==|==')
  })
})
