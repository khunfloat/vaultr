import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import { GLOBE_SVG } from '@/lib/icons'
import { isWebUrl, linkLabel } from '@/lib/url'
import { isImagePath } from '@/services/attachments'

export interface RenderContext {
  resolve(target: string): string | null
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/**
 * Markdown → HTML for reading view. Raw HTML is disabled; vault images are emitted with
 * `data-vault-src` and resolved to object URLs by the view component.
 */
export function renderMarkdown(source: string, ctx: RenderContext): string {
  const md = new MarkdownIt({ html: false, linkify: true, breaks: false, typographer: false })
  md.use(taskLists, { enabled: true, label: true })

  md.inline.ruler.before('link', 'wikilink', (state, silent) => {
    const src = state.src.slice(state.pos)
    const m = /^(!?)\[\[([^[\]|#^\n]*)(?:([#^])([^[\]|\n]*))?(?:\|([^[\]\n]*))?\]\]/.exec(src)
    if (!m) return false
    if (!silent) {
      const [, bang, target, sep, sub, alias] = m
      const full = `${target}${sep ?? ''}${sub ?? ''}`
      const resolved = target.trim() ? ctx.resolve(target.trim()) : null
      const token = state.push('html_inline', '', 0)
      if (bang && resolved && isImagePath(resolved)) {
        const width = alias && /^\d+$/.test(alias) ? ` width="${alias}"` : ''
        token.content = `<img data-vault-src="${escape(resolved)}" alt="${escape(target)}"${width}>`
      } else if (bang) {
        token.content = `<span class="md-embed${resolved ? '' : ' is-unresolved'}" data-target="${escape(full)}">↳ ${escape(full)}</span>`
      } else {
        const label = alias ?? (sub ? `${target} › ${sub}` : target)
        token.content = `<a class="wikilink${resolved ? '' : ' is-unresolved'}" data-target="${escape(full)}" href="#">${escape(label || full)}</a>`
      }
    }
    state.pos += m[0].length
    return true
  })

  md.inline.ruler.before('emphasis', 'highlight', (state, silent) => {
    if (!state.src.startsWith('==', state.pos)) return false
    const end = state.src.indexOf('==', state.pos + 2)
    if (end < 0 || end === state.pos + 2 || state.src.slice(state.pos + 2, end).includes('\n')) return false
    if (!silent) {
      state.push('html_inline', '', 0).content = '<mark>'
      const inner = state.src.slice(state.pos + 2, end)
      const text = state.push('text', '', 0)
      text.content = inner
      state.push('html_inline', '', 0).content = '</mark>'
    }
    state.pos = end + 2
    return true
  })

  md.inline.ruler.push('tag', (state, silent) => {
    if (state.src[state.pos] !== '#') return false
    const prev = state.pos === 0 ? ' ' : state.src[state.pos - 1]
    if (!/[\s(,]/.test(prev)) return false
    const m = /^#((?=[\p{L}\p{N}_/-]*[\p{L}_/-])[\p{L}\p{M}\p{N}_/-]+)/u.exec(state.src.slice(state.pos))
    if (!m) return false
    if (!silent) state.push('html_inline', '', 0).content = `<span class="md-tag" data-tag="${escape(m[1])}">#${escape(m[1])}</span>`
    state.pos += m[0].length
    return true
  })

  // Obsidian callouts: a blockquote whose first line is `[!type] Title`.
  md.core.ruler.push('callout', (state) => {
    const tokens = state.tokens
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'blockquote_open') continue
      const inline = tokens[i + 2]
      if (tokens[i + 1]?.type !== 'paragraph_open' || inline?.type !== 'inline') continue
      const m = /^\[!(\w+)\][+-]?[ \t]*([^\n]*)\n?/.exec(inline.content)
      if (!m) continue
      const kind = m[1].toLowerCase()
      tokens[i].attrJoin('class', `md-callout is-${kind}`)
      const title = m[2] || kind.charAt(0).toUpperCase() + kind.slice(1)
      // Re-parse the paragraph without the `[!type] Title` marker line.
      const rest = new state.Token('inline', '', 0)
      rest.content = inline.content.slice(m[0].length)
      rest.children = []
      state.md.inline.parse(rest.content, state.md, state.env, rest.children)
      tokens[i + 2] = rest
      const heading = new state.Token('html_block', '', 0)
      heading.content = `<div class="md-callout-title">${escape(title)}</div>\n`
      tokens.splice(i + 1, 0, heading)
    }
  })

  const defaultImage = md.renderer.rules.image!
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const src = String(token.attrGet('src') ?? '')
    if (!/^(https?:|data:|blob:)/.test(src)) {
      const resolved = ctx.resolve(decodeURIComponent(src))
      token.attrSet('src', '')
      if (resolved) token.attrSet('data-vault-src', resolved)
    }
    return defaultImage(tokens, idx, options, env, self)
  }

  // Web links render as chips; a link whose text is just its URL gets a short "host/path" label.
  md.core.ruler.push('link-chips', (state) => {
    for (const block of state.tokens) {
      const children = block.children ?? []
      children.forEach((tok, i) => {
        if (tok.type !== 'link_open') return
        const href = String(tok.attrGet('href') ?? '')
        if (!isWebUrl(href)) return
        tok.attrJoin('class', 'md-link-chip')
        tok.attrSet('title', href)
        const text = children[i + 1]
        if (text?.type === 'text' && children[i + 2]?.type === 'link_close' && (text.content === href || tok.markup === 'linkify' || tok.markup === 'autolink')) {
          text.content = linkLabel(href)
        }
      })
    }
  })

  md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
    tokens[idx].attrSet('target', '_blank')
    tokens[idx].attrSet('rel', 'noopener noreferrer')
    const open = self.renderToken(tokens, idx, options)
    return String(tokens[idx].attrGet('class') ?? '').includes('md-link-chip') ? open + GLOBE_SVG : open
  }

  return md.render(source)
}
