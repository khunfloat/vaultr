import { MemoryFs } from '@/vault/memory-fs'
import { scanVault } from './indexer'
import { buildLinkGraph } from './link-graph'
import { buildSearchIndex } from './search'

describe('performance budget', () => {
  it('indexes, links and searches 1,000 notes quickly', async () => {
    const files: Record<string, string> = {}
    for (let i = 0; i < 1000; i++) {
      const body = `---\ntags: [t${i % 20}]\n---\n# Note ${i}\n\n${'บันทึกการประชุม lorem ipsum dolor [[Note ' + ((i + 1) % 1000) + ']] #topic\n'.repeat(30)}\n- [ ] task`
      files[`notes/folder-${i % 25}/Note ${i}.md`] = body
    }
    for (let i = 0; i < 150; i++) files[`tickets/TD-${i}.md`] = `---\nkey: TD-${i}\nstatus: todo\n---\nSee [[Note ${i}]]`
    const fs = new MemoryFs({ files })

    const t0 = performance.now()
    const { files: index } = await scanVault(fs, 'perf', new Map())
    const t1 = performance.now()
    const graph = buildLinkGraph(index)
    const t2 = performance.now()
    const search = buildSearchIndex(index.values())
    const hits = search.search('ประชุม')
    const t3 = performance.now()

    expect(index.size).toBe(1150)
    expect(graph.backlinks('notes/folder-1/Note 1.md').length).toBeGreaterThan(0)
    expect(hits.length).toBeGreaterThan(0)
    // Generous limits: catch accidental O(n²) regressions, not machine noise.
    expect(t1 - t0).toBeLessThan(3000)
    expect(t2 - t1).toBeLessThan(1500)
    expect(t3 - t2).toBeLessThan(3000)
  })
})
