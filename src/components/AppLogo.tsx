import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * Vaultr mark: a blue→violet "V" on a dark rounded square. Keep in sync with the favicon data URI in index.html.
 */
export function AppLogo({ className }: { className?: string }) {
  const gradient = useId()
  return (
    <svg viewBox="0 0 32 32" className={cn('size-7 shrink-0', className)} aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="#0a0a0a" />
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="7.25" fill="none" stroke="#3f3f46" strokeWidth="1.5" />
      <path d="M8.5 9l7.5 14.5L23.5 9" fill="none" stroke={`url(#${gradient})`} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
