import { z } from 'zod'
import type { VaultFs } from './vault-fs'

export const VAULT_DIRS = {
  notes: 'notes',
  tickets: 'tickets',
  attachments: 'attachments',
  app: '.vaultr',
} as const

export const CONFIG_PATH = `${VAULT_DIRS.app}/config.json`

/** App folder used before the product was named Vaultr. Migrated on open. */
export const LEGACY_APP_DIR = '.todoapp'

export const vaultConfigSchema = z.object({
  version: z.literal(1),
  vaultId: z.string().min(1),
  ticketPrefix: z.string().regex(/^[A-Z][A-Z0-9]{0,9}$/).default('TD'),
  nextTicketNumber: z.number().int().min(1).default(1),
})

export type VaultConfig = z.infer<typeof vaultConfigSchema>

/** Create the vault folders and config if missing. Never overwrites an existing valid config. */
export async function ensureVaultSkeleton(fs: VaultFs, newId: () => string = () => crypto.randomUUID()): Promise<VaultConfig> {
  await migrateLegacyAppDir(fs)
  for (const dir of Object.values(VAULT_DIRS)) await fs.mkdir(dir)

  const existing = await fs.stat(CONFIG_PATH)
  if (existing) {
    const parsed = vaultConfigSchema.safeParse(safeJson(await fs.readText(CONFIG_PATH)))
    if (parsed.success) return parsed.data
    // Keep the broken file for manual recovery instead of silently overwriting it.
    await fs.move(CONFIG_PATH, `${VAULT_DIRS.app}/config.broken-${Date.now()}.json`)
  }

  const config: VaultConfig = { version: 1, vaultId: newId(), ticketPrefix: 'TD', nextTicketNumber: 1 }
  await writeVaultConfig(fs, config)
  return config
}

/**
 * Move `.todoapp/*` into `.vaultr/` so vaults created before the rename keep their vault id and
 * ticket numbering. Never overwrites files already in `.vaultr/`.
 */
async function migrateLegacyAppDir(fs: VaultFs) {
  const legacy = await fs.list(LEGACY_APP_DIR).catch(() => null)
  if (!legacy) return
  await fs.mkdir(VAULT_DIRS.app)
  for (const entry of legacy) {
    if (entry.kind !== 'file') continue
    const target = `${VAULT_DIRS.app}/${entry.path.slice(LEGACY_APP_DIR.length + 1)}`
    if (!(await fs.stat(target))) await fs.move(entry.path, target)
  }
  if ((await fs.list(LEGACY_APP_DIR)).length === 0) await fs.remove(LEGACY_APP_DIR)
}

export async function writeVaultConfig(fs: VaultFs, config: VaultConfig): Promise<void> {
  await fs.writeText(CONFIG_PATH, JSON.stringify(vaultConfigSchema.parse(config), null, 2) + '\n')
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
