import { Document, isMap, parseDocument } from 'yaml'

export type FrontmatterData = Record<string, unknown>

export interface ParsedMarkdown {
  data: FrontmatterData
  body: string
  /** Raw YAML between the fences, or null when the file has no frontmatter. */
  raw: string | null
  /** Set when frontmatter exists but is not a valid YAML mapping. Writers must not rewrite it. */
  error: string | null
}

const FENCE = /^---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/

export function parseMarkdown(source: string): ParsedMarkdown {
  const text = source.replace(/^﻿/, '')
  const m = FENCE.exec(text)
  if (!m) return { data: {}, body: text, raw: null, error: null }
  const raw = m[1] ?? ''
  const body = text.slice(m[0].length)
  const doc = parseYaml(raw)
  if (doc.errors.length) return { data: {}, body, raw, error: doc.errors[0].message }
  const value = doc.toJS() ?? {}
  if (!isPlainObject(value)) return { data: {}, body, raw, error: 'Frontmatter is not a key/value mapping' }
  return { data: value, body, raw, error: null }
}

/**
 * Apply a patch to a file's frontmatter, keeping key order, comments and unknown keys.
 * `undefined` values delete the key. Creates frontmatter if the file has none.
 */
export function updateFrontmatter(source: string, patch: FrontmatterData): string {
  const parsed = parseMarkdown(source)
  if (parsed.error) throw new Error(`Cannot update invalid frontmatter: ${parsed.error}`)
  const parsedDoc = parseYaml(parsed.raw ?? '')
  // Empty frontmatter parses to a null document; start a fresh mapping in that case.
  const doc: Document = isMap(parsedDoc.contents) ? parsedDoc : new Document({})
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) doc.delete(key)
    else doc.set(key, doc.createNode(value, { flow: Array.isArray(value) }))
  }
  return composeMarkdown(doc.toString(), parsed.body)
}

/** Replace the body while keeping frontmatter byte-for-byte. */
export function replaceBody(source: string, body: string): string {
  const parsed = parseMarkdown(source)
  return parsed.raw === null ? body : composeMarkdown(parsed.raw, body)
}

export function stringifyMarkdown(data: FrontmatterData, body: string): string {
  if (!Object.keys(data).length) return body
  return updateFrontmatter(composeMarkdown('', body), data)
}

function composeMarkdown(yaml: string, body: string): string {
  const y = yaml.replace(/\s+$/, '')
  return `---\n${y ? y + '\n' : ''}---\n${body}`
}

function parseYaml(raw: string): Document.Parsed {
  // Core schema keeps `2026-09-15` as a string instead of a Date.
  return parseDocument(raw, { schema: 'core', keepSourceTokens: false, prettyErrors: false })
}

function isPlainObject(v: unknown): v is FrontmatterData {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
