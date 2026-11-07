import { NavLink, Navigate, Route, Routes } from 'react-router'
import { BarChart3, CalendarClock, FileText, FolderOpen, Gauge, History, Image, Inbox, KeyRound, LayoutTemplate, ListTree, LogOut, Newspaper, Trash2, Users } from 'lucide-react'
import { Suspense, lazy } from 'react'
import type { ReactNode } from 'react'
import type { Capability } from '@petrik/shared/roles'
import { ROLE_LABEL } from '@petrik/shared/roles'
import { useSession } from './session.tsx'
import { cx } from './ui.tsx'
import { Login } from './screens/Login.tsx'
import { Dashboard } from './screens/Dashboard.tsx'
import { PostList } from './screens/PostList.tsx'
import { PageList } from './screens/PageList.tsx'
import { MenuEditor } from './screens/MenuEditor.tsx'
import { MediaLibrary } from './screens/MediaLibrary.tsx'
import { LibraryEditor } from './screens/LibraryEditor.tsx'
import { UsersScreen } from './screens/Users.tsx'
import { AuditScreen } from './screens/Audit.tsx'
import { Statistics } from './screens/Statistics.tsx'
import { Account, ForcedPasswordChange } from './screens/Account.tsx'

// The two editors carry TipTap: loaded on first use.
const PostEditor = lazy(() => import('./screens/PostEditor.tsx').then((m) => ({ default: m.PostEditor })))
const PageEditor = lazy(() => import('./screens/PageEditor.tsx').then((m) => ({ default: m.PageEditor })))

type NavItem = { to: string; label: string; icon: ReactNode; caps?: Capability[] }

const NAV: { title?: string; items: NavItem[] }[] = [
  { items: [{ to: '/', label: 'Áttekintés', icon: <Gauge size={16} /> }] },
  {
    title: 'Hírek',
    items: [
      { to: '/hirek/uj', label: 'Új hír', icon: <Newspaper size={16} />, caps: ['news.write'] },
      { to: '/hirek/jovahagyas', label: 'Jóváhagyásra vár', icon: <Inbox size={16} />, caps: ['news.review'] },
      { to: '/hirek/idozitett', label: 'Időzített', icon: <CalendarClock size={16} />, caps: ['news.review'] },
      { to: '/hirek/kint', label: 'Publikált', icon: <FileText size={16} />, caps: ['news.manage'] },
      { to: '/hirek/archivum', label: 'Archívum', icon: <History size={16} />, caps: ['news.manage'] },
      { to: '/hirek/lomtar', label: 'Lomtár', icon: <Trash2 size={16} />, caps: ['news.write', 'news.review'] },
    ],
  },
  {
    title: 'Webhely',
    items: [
      { to: '/oldalak', label: 'Oldalak', icon: <LayoutTemplate size={16} />, caps: ['pages.manage'] },
      { to: '/menu', label: 'Menü', icon: <ListTree size={16} />, caps: ['pages.manage'] },
      { to: '/media', label: 'Médiatár', icon: <Image size={16} />, caps: ['media.upload', 'pages.manage', 'library.manage'] },
      { to: '/dokumentumtar', label: 'Dokumentumtár', icon: <FolderOpen size={16} />, caps: ['library.manage'] },
    ],
  },
  {
    title: 'Adminisztráció',
    items: [
      { to: '/fiokok', label: 'Fiókok', icon: <Users size={16} />, caps: ['users.manage'] },
      { to: '/naplo', label: 'Napló', icon: <History size={16} />, caps: ['audit.view'] },
      { to: '/statisztika', label: 'Statisztika', icon: <BarChart3 size={16} />, caps: ['audit.view'] },
      { to: '/fiokom', label: 'Saját fiók', icon: <KeyRound size={16} /> },
    ],
  },
]

function Guard({ caps, children }: { caps?: Capability[]; children: ReactNode }) {
  const { can } = useSession()
  if (caps && !caps.some(can)) return <p className="text-petriksoft">Ehhez a részhez nincs jogosultságod.</p>
  return <>{children}</>
}

export function App() {
  const { user, loading, can, logout } = useSession()
  if (loading) return null
  if (!user) return <Login />
  if (user.mustChangePassword) return <ForcedPasswordChange />

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="border-b border-petrikline bg-petrikink text-petriklink md:min-h-screen md:border-b-0">
        <div className="px-5 py-5">
          <a href="/" className="font-display text-xl font-bold text-white">
            Petrik admin
          </a>
          <p className="mt-1 text-sm">{user.displayName}</p>
          <p className="font-mono text-[11px] uppercase tracking-wider text-petriklink/60">{ROLE_LABEL[user.role]}</p>
        </div>
        <nav className="px-3 pb-5 text-sm">
          {NAV.map((group, i) => {
            const items = group.items.filter((item) => !item.caps || item.caps.some(can))
            if (!items.length) return null
            return (
              <div key={i} className="mb-3">
                {group.title && <p className="px-2 pb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-petriklink/50">{group.title}</p>}
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) => cx('flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/10 hover:text-white', isActive && 'bg-white/10 text-white')}
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )
          })}
          <button type="button" onClick={logout} className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/10 hover:text-white">
            <LogOut size={16} />
            Kijelentkezés
          </button>
        </nav>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-8 md:py-8">
        <Suspense fallback={<p className="text-sm text-petrikfaint">Betöltés…</p>}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/hirek/uj" element={<Guard caps={['news.write']}><PostEditor /></Guard>} />
          <Route path="/hirek/:id" element={<PostEditor />} />
          <Route path="/hirek/jovahagyas" element={<Guard caps={['news.review']}><PostList status="in_review" /></Guard>} />
          <Route path="/hirek/idozitett" element={<Guard caps={['news.review']}><PostList status="scheduled" /></Guard>} />
          <Route path="/hirek/kint" element={<Guard caps={['news.manage']}><PostList status="published" /></Guard>} />
          <Route path="/hirek/archivum" element={<Guard caps={['news.manage']}><PostList status="archived" /></Guard>} />
          <Route path="/hirek/lomtar" element={<Guard caps={['news.write', 'news.review']}><PostList status="trash" /></Guard>} />
          <Route path="/oldalak" element={<Guard caps={['pages.manage']}><PageList /></Guard>} />
          <Route path="/oldalak/:id" element={<Guard caps={['pages.manage']}><PageEditor /></Guard>} />
          <Route path="/menu" element={<Guard caps={['pages.manage']}><MenuEditor /></Guard>} />
          <Route path="/media" element={<Guard caps={['media.upload', 'pages.manage', 'library.manage']}><MediaLibrary /></Guard>} />
          <Route path="/dokumentumtar" element={<Guard caps={['library.manage']}><LibraryEditor /></Guard>} />
          <Route path="/fiokok" element={<Guard caps={['users.manage']}><UsersScreen /></Guard>} />
          <Route path="/naplo" element={<Guard caps={['audit.view']}><AuditScreen /></Guard>} />
          <Route path="/statisztika" element={<Guard caps={['audit.view']}><Statistics /></Guard>} />
          <Route path="/fiokom" element={<Account />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </main>
    </div>
  )
}
