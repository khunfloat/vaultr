import { CONFIG_PATH, ensureVaultSkeleton, LEGACY_APP_DIR } from './config'
import { MemoryFs } from './memory-fs'

describe('ensureVaultSkeleton', () => {
  it('creates folders and config once', async () => {
    const fs = new MemoryFs()
    const c1 = await ensureVaultSkeleton(fs, () => 'id-1')
    const c2 = await ensureVaultSkeleton(fs, () => 'id-2')
    expect(c1).toEqual({ version: 1, vaultId: 'id-1', ticketPrefix: 'TD', nextTicketNumber: 1 })
    expect(c2.vaultId).toBe('id-1')
    expect((await fs.list('')).map((e) => e.path)).toEqual(['.vaultr', 'attachments', 'notes', 'tickets'])
  })

  it('keeps a broken config aside instead of overwriting', async () => {
    const fs = new MemoryFs({ files: { [CONFIG_PATH]: '{ not json' } })
    const c = await ensureVaultSkeleton(fs, () => 'fresh')
    expect(c.vaultId).toBe('fresh')
    const names = (await fs.list('.vaultr')).map((e) => e.path)
    expect(names.some((n) => n.includes('config.broken-'))).toBe(true)
  })

  it('migrates a pre-rename .todoapp folder, keeping vault id and ticket numbering', async () => {
    const legacy = JSON.stringify({ version: 1, vaultId: 'old-id', ticketPrefix: 'TD', nextTicketNumber: 42 })
    const fs = new MemoryFs({ files: { [`${LEGACY_APP_DIR}/config.json`]: legacy, 'notes/a.md': 'x' } })
    const c = await ensureVaultSkeleton(fs, () => 'new-id')
    expect(c).toMatchObject({ vaultId: 'old-id', nextTicketNumber: 42 })
    expect(await fs.readText(CONFIG_PATH)).toBe(legacy)
    expect((await fs.list('')).map((e) => e.path)).toEqual(['.vaultr', 'attachments', 'notes', 'tickets'])
  })

  it('does not overwrite an existing .vaultr config during migration', async () => {
    const fs = new MemoryFs({
      files: {
        [CONFIG_PATH]: JSON.stringify({ version: 1, vaultId: 'current', ticketPrefix: 'TD', nextTicketNumber: 5 }),
        [`${LEGACY_APP_DIR}/config.json`]: JSON.stringify({ version: 1, vaultId: 'stale', ticketPrefix: 'TD', nextTicketNumber: 1 }),
      },
    })
    expect((await ensureVaultSkeleton(fs)).vaultId).toBe('current')
    expect(await fs.stat(`${LEGACY_APP_DIR}/config.json`)).not.toBeNull()
  })
})
