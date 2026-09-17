import { WidgetType, type EditorView } from '@codemirror/view'
import { GLOBE_SVG } from '@/lib/icons'
import { linkLabel } from '@/lib/url'
import type { EditorContextRef } from './link-context'

export class CheckboxWidget extends WidgetType {
  readonly checked: boolean
  readonly pos: number

  constructor(checked: boolean, pos: number) {
    super()
    this.checked = checked
    this.pos = pos
  }
  eq(other: CheckboxWidget) {
    return other.checked === this.checked && other.pos === this.pos
  }
  toDOM(view: EditorView) {
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.className = 'cm-lp-checkbox'
    box.checked = this.checked
    box.addEventListener('mousedown', (e) => e.preventDefault())
    box.addEventListener('click', (e) => {
      e.preventDefault()
      const text = view.state.doc.sliceString(this.pos, this.pos + 3)
      if (!/^\[[ xX]\]$/.test(text)) return
      view.dispatch({ changes: { from: this.pos + 1, to: this.pos + 2, insert: this.checked ? ' ' : 'x' } })
    })
    return box
  }
  ignoreEvent() {
    return true
  }
}

export class BulletWidget extends WidgetType {
  eq() {
    return true
  }
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-lp-bullet'
    span.textContent = '•'
    return span
  }
}

export class ImageWidget extends WidgetType {
  readonly src: string
  readonly vaultPath: string | null
  readonly alt: string
  readonly ctx: EditorContextRef

  constructor(src: string, vaultPath: string | null, alt: string, ctx: EditorContextRef) {
    super()
    this.src = src
    this.vaultPath = vaultPath
    this.alt = alt
    this.ctx = ctx
  }
  eq(other: ImageWidget) {
    return other.src === this.src && other.vaultPath === this.vaultPath && other.alt === this.alt
  }
  toDOM() {
    const wrap = document.createElement('span')
    wrap.className = 'cm-lp-image'
    const img = document.createElement('img')
    img.alt = this.alt
    if (this.vaultPath) {
      void this.ctx.current.loadImage(this.vaultPath).then((url) => {
        if (url) img.src = url
        else wrap.replaceChildren(missing(this.vaultPath!))
      })
    } else if (this.src) {
      img.src = this.src
    } else {
      return missing(this.alt || 'image')
    }
    wrap.appendChild(img)
    return wrap
  }
  get estimatedHeight() {
    return 200
  }
}

export class EmbedWidget extends WidgetType {
  readonly target: string
  readonly resolved: string | null

  constructor(target: string, resolved: string | null) {
    super()
    this.target = target
    this.resolved = resolved
  }
  eq(other: EmbedWidget) {
    return other.target === this.target && other.resolved === this.resolved
  }
  toDOM() {
    const el = document.createElement('span')
    el.className = 'cm-lp-embed'
    el.dataset.target = this.target
    el.textContent = `↳ ${this.target}`
    if (!this.resolved) el.classList.add('is-unresolved')
    return el
  }
}

export class HrWidget extends WidgetType {
  eq() {
    return true
  }
  toDOM() {
    const hr = document.createElement('span')
    hr.className = 'cm-lp-hr'
    return hr
  }
}

export class TableWidget extends WidgetType {
  readonly source: string

  constructor(source: string) {
    super()
    this.source = source
  }
  eq(other: TableWidget) {
    return other.source === this.source
  }
  toDOM() {
    const rows = this.source
      .split('\n')
      .filter((l) => l.trim())
      .map(splitRow)
    const wrap = document.createElement('div')
    wrap.className = 'cm-lp-table'
    const table = document.createElement('table')
    const [head, delim, ...body] = rows
    const aligns = (delim ?? []).map((c) => (/^:-+:$/.test(c) ? 'center' : /-+:$/.test(c) ? 'right' : 'left'))
    const tr = (cells: string[], tag: 'th' | 'td') => {
      const row = document.createElement('tr')
      cells.forEach((c, i) => {
        const cell = document.createElement(tag)
        cell.textContent = c
        cell.style.textAlign = aligns[i] ?? 'left'
        row.appendChild(cell)
      })
      return row
    }
    const thead = document.createElement('thead')
    if (head) thead.appendChild(tr(head, 'th'))
    const tbody = document.createElement('tbody')
    for (const r of body) tbody.appendChild(tr(r, 'td'))
    table.append(thead, tbody)
    wrap.appendChild(table)
    return wrap
  }
  ignoreEvent() {
    return false
  }
}

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'))
}

function missing(name: string) {
  const el = document.createElement('span')
  el.className = 'cm-lp-missing'
  el.textContent = `Missing: ${name}`
  return el
}

export class CalloutTitleWidget extends WidgetType {
  readonly kind: string
  readonly title: string

  constructor(kind: string, title: string) {
    super()
    this.kind = kind
    this.title = title
  }
  eq(other: CalloutTitleWidget) {
    return other.kind === this.kind && other.title === this.title
  }
  toDOM() {
    const el = document.createElement('span')
    el.className = 'cm-lp-callout-title'
    el.textContent = this.title || this.kind.charAt(0).toUpperCase() + this.kind.slice(1)
    return el
  }
}

/** External http(s) link rendered as a clickable chip; opens in a new tab. */
export class LinkChipWidget extends WidgetType {
  readonly href: string
  readonly text: string

  constructor(href: string, text: string) {
    super()
    this.href = href
    this.text = text
  }
  eq(other: LinkChipWidget) {
    return other.href === this.href && other.text === this.text
  }
  toDOM() {
    const a = document.createElement('a')
    a.className = 'cm-lp-chip'
    a.href = this.href
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.title = this.href
    a.innerHTML = GLOBE_SVG
    const label = document.createElement('span')
    label.textContent = !this.text || this.text === this.href ? linkLabel(this.href) : this.text
    a.appendChild(label)
    // Let the browser follow the link; keep CodeMirror from moving the cursor on mousedown.
    a.addEventListener('mousedown', (e) => e.preventDefault())
    return a
  }
  ignoreEvent() {
    return true
  }
}

/** Replaces the opening ``` fence of an inactive code block with a small language label. */
export class CodeLangWidget extends WidgetType {
  readonly lang: string

  constructor(lang: string) {
    super()
    this.lang = lang
  }
  eq(other: CodeLangWidget) {
    return other.lang === this.lang
  }
  toDOM() {
    const el = document.createElement('span')
    el.className = 'cm-lp-code-lang'
    el.textContent = this.lang
    return el
  }
}
