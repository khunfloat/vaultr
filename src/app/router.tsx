import { createHashRouter, Navigate } from 'react-router'
import { BoardPage } from '@/features/board/BoardPage'
import { NotesPage } from '@/features/notes/NotesPage'
import { SearchPage } from '@/features/search/SearchPage'
import { AppShell } from './AppShell'
import { RouteError } from './RouteError'

export const router = createHashRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/board" replace /> },
      { path: 'board', element: <BoardPage /> },
      { path: 'notes', element: <NotesPage /> },
      { path: 'notes/*', element: <NotesPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: '*', element: <Navigate to="/board" replace /> },
    ],
  },
])
