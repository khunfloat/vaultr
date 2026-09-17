import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { createNote } from '@/services/notes'
import { routes } from '@/lib/routes'
import { useUi } from './ui-store'

/** App-wide keyboard shortcuts that aren't owned by a specific component. */
export function GlobalShortcuts() {
  const navigate = useNavigate()
  const setShortcutsOpen = useUi((s) => s.setShortcutsOpen)
  const setNewTicket = useUi((s) => s.setNewTicket)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const key = e.key.toLowerCase()
      if (e.shiftKey && key === 'f') {
        e.preventDefault()
        navigate('/search')
      } else if (e.altKey && key === 'n') {
        e.preventDefault()
        createNote()
          .then((p) => navigate(routes.note(p)))
          .catch((err: Error) => toast.error(err.message))
      } else if (e.altKey && key === 't') {
        e.preventDefault()
        navigate(routes.board())
        setNewTicket('todo')
      } else if (key === '/') {
        e.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, setShortcutsOpen, setNewTicket])

  return null
}
