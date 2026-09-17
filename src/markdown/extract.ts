export interface WikiLink {
  /** Link target as written, without heading/block/alias: `[[Login flow#Sequence|x]]` → `Login flow`. */
  target: string
  heading: string | null
  alias: string | null
  embed: boolean
  line: number
}

export interface Heading {
  level: number
  text: string
  line: number
}

export interface MarkdownFacts {
  links: WikiLink[]
  tags: string[]
  headings: Heading[]
  tasks: { done: number; total: number }
}

const WIKILINK = /(!?)\[\[([^[\]|#^\n]*)(?:[#^]([^[\]|\n]*))?(?:\|([^[\]\n]*))?\]\]/g
// Obsidian tags: must contain at least one non-digit, allow unicode letters, `/`, `-`, `_`.
const TAG = /(?:^|[\s(,])#((?=[\p{L}\p{N}_/-]*[\p{L}_/-])[\p{L}\p{M}\p{N}_/-]+)/gu
const HEADING = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/
const TASK = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+\[([ xX])\]/
const FENCE_OPEN = /^[ \t]{0,3}(`{3,}|~{3,})/

/** Extract links, tags, headings and task counts from a markdown body (frontmatter already removed). */
export function extractFacts(body: string): MarkdownFacts {
  const links: WikiLink[] = []
  const tags = new Set<string>()
  const headings: Heading[] = []
  let done = 0
  let total = 0
  let fence: string | null = null

  body.split(/\r?\n/).forEach((line, i) => {
    const f = FENCE_OPEN.exec(line)
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && !line.trim().slice(f[1].length).trim()) fence = null
      return
    }
    if (f) {
      fence = f[1]
      return
    }

    const h = HEADING.exec(line)
    if (h) headings.push({ level: h[1].length, text: h[2], line: i })

    const t = TASK.exec(line)
    if (t) {
      total++
      if (t[1] !== ' ') done++
    }

    const text = stripInlineCode(line)
    for (const m of text.matchAll(WIKILINK)) {
      const target = m[2].trim()
      if (!target && !m[3]) continue
      links.push({
        target,
        heading: m[3]?.trim() || null,
        alias: m[4]?.trim() || null,
        embed: m[1] === '!',
        line: i,
      })
    }
    // Drop link targets first so `[[a#b]]` and `](url#frag)` don't produce tags.
    const withoutLinks = text.replace(WIKILINK, ' ').replace(/\]\([^)]*\)/g, ' ')
    for (const m of withoutLinks.matchAll(TAG)) tags.add(m[1])
  })

  return { links, tags: [...tags], headings, tasks: { done, total } }
}

/** Tags from frontmatter `tags:` — accepts a list or a comma/space separated string. */
export function frontmatterTags(value: unknown): string[] {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,\s]+/) : []
  return items
    .map((v) => String(v).trim().replace(/^#/, ''))
    .filter(Boolean)
}

function stripInlineCode(line: string): string {
  return line.replace(/(`+)[^`]*?\1/g, (s) => ' '.repeat(s.length))
}
