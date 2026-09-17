import { addDays, format, subDays } from 'date-fns'
import { MemoryFs } from '@/vault/memory-fs'

/**
 * Rich sample vault for `?fs=demo`: used for README screenshots and for trying the app without a folder.
 * Dates are relative to today so deadlines always show a realistic mix of overdue / soon / later.
 */
export function createDemoVault(today = new Date()): MemoryFs {
  const d = (days: number) => format(days < 0 ? subDays(today, -days) : addDays(today, days), 'yyyy-MM-dd')
  const ts = (days: number) => `${d(days)}T09:30:00+07:00`
  const ticket = (n: number, fm: Record<string, string | string[]>, body: string) => {
    const lines = Object.entries({ key: `VR-${n}`, ...fm }).map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : v}`)
    return [`tickets/VR-${n}.md`, `---\n${lines.join('\n')}\ncreated: ${ts(-12)}\nupdated: ${ts(-1)}\n---\n${body}`] as const
  }

  const files: Record<string, string> = Object.fromEntries([
    ['.vaultr/config.json', JSON.stringify({ version: 1, vaultId: 'demo', ticketPrefix: 'VR', nextTicketNumber: 25 })],

    ticket(12, { title: 'Fix login timeout on SSO callback', status: 'in-progress', priority: 'urgent', deadline: d(-2), labels: ['bug', 'auth'], order: 'a0' },
      `## Context
Users are sent back to the login page after ~30 s on the SSO callback. Started after the IdP certificate rotation — see [[Login flow]] and [[Incident 2026-09 SSO]].

## Error log
\`\`\`log
09:12:04 ERROR auth.callback: token exchange timed out
  at exchangeCode (oauth.ts:88) status=504 elapsed=30012ms
\`\`\`

![[attachments/sso-sequence.svg]]

## Checklist
- [x] Reproduce on staging
- [x] Capture HAR file
- [ ] Raise timeout to 60 s behind a flag
- [ ] Confirm new certificate chain with IT

Runbook: [IdP rotation guide](https://example.com/runbooks/idp-rotation)
`),
    ticket(15, { title: 'Migrate monthly report to the new template', status: 'in-progress', priority: 'high', deadline: d(1), labels: ['reporting'], order: 'a1' },
      `Move the September report to the new layout from [[Q4 Planning]].\n\n- [x] Export data\n- [x] Charts\n- [x] Commentary\n- [ ] Review with finance\n- [ ] Publish\n`),
    ticket(17, { title: 'Draft onboarding checklist for new engineers', status: 'in-progress', priority: 'medium', deadline: d(9), labels: ['team'], order: 'a2' },
      `Start from [[Onboarding]] and turn it into a checklist.\n`),
    ticket(18, { title: 'Prepare Q4 budget slides for finance review', status: 'todo', priority: 'high', deadline: d(2), labels: ['finance', 'planning'], order: 'a0' },
      `Numbers live in [[Q4 Planning]].\n\n- [ ] Headcount\n- [ ] Tooling\n- [ ] Cloud spend\n- [ ] Training\n- [ ] Contingency\n`),
    ticket(21, { title: 'Request VPN access for new contractor', status: 'todo', priority: 'medium', deadline: d(12), labels: ['admin'], order: 'a1' }, ''),
    ticket(22, { title: 'Review vendor contract renewal terms', status: 'todo', priority: 'low', labels: ['legal'], order: 'a2' },
      `![[attachments/sso-sequence.svg]]\n`),
    ticket(23, { title: 'Set up error budget alerts for the API', status: 'todo', priority: 'medium', deadline: d(5), labels: ['sre'], order: 'a3' },
      `Thresholds agreed in [[Weekly sync 2026-09-15]].\n`),
    ticket(24, { title: 'Clean up shared drive folder structure', status: 'todo', priority: 'low', order: 'a4' }, ''),
    ticket(9, { title: 'Set up weekly sync agenda', status: 'done', priority: 'medium', labels: ['team'], order: 'a0', done: ts(-3) }, ''),
    ticket(11, { title: 'Export Q3 KPI data from dashboard', status: 'done', priority: 'high', order: 'a1', done: ts(-4) }, `- [x] Revenue\n- [x] Churn\n- [x] NPS\n- [x] Latency\n`),
    ticket(8, { title: 'Update team contact sheet', status: 'done', priority: 'low', order: 'a2', done: ts(-6) }, ''),

    ['notes/Projects/SSO Migration/Login flow.md', `---
tags: [sso, auth]
owner: Platform team
status: active
---
How SSO login works end to end. The current incident is tracked in [[VR-12]]; background in [[Incident 2026-09 SSO]].

> [!note] Timeouts
> The token exchange must finish within the gateway timeout (**30 s**) or the session is dropped.

## Sequence
1. User opens \`/login\` and is redirected to the IdP
2. IdP posts back to \`/auth/callback\` with a \`code\`
3. Backend exchanges the code for tokens and sets the session cookie

![[attachments/sso-sequence.svg]]

## Endpoints
| Environment | Callback URL | Timeout |
| --- | --- | --- |
| staging | \`stg.example.com/auth/callback\` | 30 s |
| production | \`app.example.com/auth/callback\` | 30 s |

## Config
\`\`\`ts
export const oauth = {
  issuer: 'https://idp.example.com',
  tokenTimeoutMs: 30_000,
}
\`\`\`

## Open questions
- [ ] Does the gateway retry on 504? #question
- [x] Confirm the certificate chain with IT

Spec: [OAuth 2.0 authorization code flow](https://datatracker.ietf.org/doc/html/rfc6749#section-4.1) · ==Latency spikes after 09:00 when everyone logs in==
`],
    ['notes/Projects/SSO Migration/Incident 2026-09 SSO.md', `---
tags: [incident, sso]
severity: high
---
> [!warning] Customer impact
> About 8% of logins failed between 09:00 and 09:40.

## Timeline
- 09:02 IdP certificate rotated
- 09:12 First timeout alerts
- 09:40 Mitigated by raising the gateway timeout

## Follow-ups
- [ ] [[VR-12]] Permanent fix for the callback timeout
- [ ] [[VR-23]] Error budget alerts

Related: [[Login flow]], [[Rollout plan]] #postmortem
`],
    ['notes/Projects/SSO Migration/Rollout plan.md', `Phase 1 depends on the [[Login flow]] fix landing first.\n\n| Phase | Audience | Date |\n| --- | --- | --- |\n| 1 | Internal | ${d(7)} |\n| 2 | 10% customers | ${d(14)} |\n| 3 | Everyone | ${d(21)} |\n\n> [!tip] Rollback\n> Flip the \`sso_v2\` flag off — no deploy needed.\n`],
    ['notes/Projects/Q4 Planning.md', `---
tags: [planning, finance]
---
## Goals
1. Ship SSO v2 to everyone — see [[Rollout plan]]
2. Cut p95 API latency by 30%
3. Hire two engineers

## Budget
| Area | Q3 | Q4 | Δ |
| --- | ---: | ---: | ---: |
| Headcount | 410k | 455k | +11% |
| Cloud | 96k | 88k | −8% |
| Tooling | 22k | 24k | +9% |

Slides: [[VR-18]] #okr
`],
    ['notes/Meetings/Weekly sync 2026-09-15.md', `---
tags: [meeting]
attendees: [Ann, Ben, Chai, Dana]
---
## Notes
- Walked through the [[Login flow]] diagram
- Error budget: alert at **2%** burn over 1 h → [[VR-23]]
- Onboarding: see [[Onboarding]]

## Action items
- [x] Ann — share incident timeline
- [ ] Ben — draft alert thresholds
- [ ] Chai — update [[Q4 Planning]] numbers
`],
    ['notes/Meetings/Weekly sync 2026-09-08.md', `- Q3 KPI export done ([[VR-11]])\n- Planning kickoff for [[Q4 Planning]] #planning\n`],
    ['notes/Team/Onboarding.md', `---
tags: [team, howto]
---
Welcome! Start here.

## First day
- [ ] Laptop and accounts
- [ ] Read [[Login flow]]
- [ ] Join the weekly sync ([[Weekly sync 2026-09-15]])

> [!question] Who do I ask?
> Your onboarding buddy, or post in #help.
`],
    ['notes/Inbox.md', `- Idea: dark-mode export for reports #idea\n- Read later: [Designing data-intensive applications](https://dataintensive.net)\n`],
    ['attachments/sso-sequence.svg', SSO_DIAGRAM],
  ])

  return new MemoryFs({ name: 'Team Vault', files })
}

const SSO_DIAGRAM = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 220" font-family="Segoe UI, system-ui, sans-serif" font-size="13">
<rect width="640" height="220" rx="12" fill="#111827"/>
<g fill="#1f2937" stroke="#374151"><rect x="30" y="30" width="120" height="40" rx="8"/><rect x="260" y="30" width="120" height="40" rx="8"/><rect x="490" y="30" width="120" height="40" rx="8"/></g>
<g fill="#e5e7eb" text-anchor="middle"><text x="90" y="55">Browser</text><text x="320" y="55">Identity provider</text><text x="550" y="55">Backend</text></g>
<g stroke="#4b5563" stroke-dasharray="4 4"><line x1="90" y1="70" x2="90" y2="200"/><line x1="320" y1="70" x2="320" y2="200"/><line x1="550" y1="70" x2="550" y2="200"/></g>
<g stroke-width="2" fill="none"><path d="M90 100H316" stroke="#60a5fa"/><path d="M320 135H94" stroke="#a78bfa"/><path d="M90 170H546" stroke="#4ade80"/></g>
<g fill="#9ca3af" font-size="12"><text x="205" y="94" text-anchor="middle">1 · redirect /login</text><text x="205" y="129" text-anchor="middle">2 · POST /auth/callback (code)</text><text x="318" y="164" text-anchor="middle">3 · exchange code → session</text></g>
</svg>`
