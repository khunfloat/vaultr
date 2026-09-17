import { MemoryFs } from '@/vault/memory-fs'

// 16x10 blue PNG so image embeds render in dev/e2e.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAKCAIAAAA7N+mxAAAAGUlEQVR4nGNkaGBgIAUwkaR6VMOohsGkAQDMvwGB4Bym5AAAAABJRU5ErkJggg=='

/** Seed vault for `?fs=memory` dev mode and e2e tests. */
export function createFixtureVault(): MemoryFs {
  const fs = new MemoryFs({
    name: 'FixtureVault',
    files: {
      '.vaultr/config.json': JSON.stringify({ version: 1, vaultId: 'fixture', ticketPrefix: 'TD', nextTicketNumber: 13 }),
      'notes/Projects/SSO Migration/Login flow.md':
        '---\ntags: [sso, auth]\n---\n# Login flow\n\nอธิบายการทำงานของ SSO login ปัญหาติดตามใน [[TD-12]] เกี่ยวกับ [[Callback errors]] #incident\n\n## Sequence\n- [x] redirect\n- [ ] exchange code\n',
      'notes/Projects/SSO Migration/Callback errors.md': '# Callback errors\n\nSee [[Login flow#Sequence]].\n',
      'notes/Meetings/2026-09-15 ประชุมทีม.md': '# ประชุมทีม\n\n- คุยเรื่อง [[Login flow]]\n',
      'notes/Inbox.md': 'quick notes #inbox\n',
      'tickets/TD-12.md':
        '---\nkey: TD-12\ntitle: Fix login timeout on SSO callback\nstatus: in-progress\npriority: urgent\ndeadline: 2026-09-15\nlabels: [bug, auth]\norder: a0\n---\n## Context\nผู้ใช้โดนเด้งกลับหน้า login ดู [[Login flow]]\n\n- [x] reproduce\n- [ ] fix\n',
      'tickets/TD-11.md':
        '---\nkey: TD-11\ntitle: เตรียมสไลด์งบประมาณ Q4\nstatus: todo\npriority: high\ndeadline: 2026-09-19\nlabels: [finance]\norder: a0\n---\n',
    },
  })
  const bytes = Uint8Array.from(atob(PNG_BASE64), (c) => c.charCodeAt(0))
  void fs.writeBlob('attachments/sso-error.png', new Blob([bytes], { type: 'image/png' }))
  return fs
}
