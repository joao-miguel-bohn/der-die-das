import { useQueryClient } from '@tanstack/react-query'
import { BookOpen, GraduationCap, LayoutDashboard, LogOut, Moon, Settings, Sun, Upload } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { useMe } from '@/hooks/use-me'
import { authClient } from '@/lib/auth-client'
import { cn } from '@/lib/utils'

export function Layout() {
  const { data: me } = useMe()
  const { resolvedTheme, setTheme } = useTheme()
  const queryClient = useQueryClient()

  const links = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/study', label: 'Study', icon: GraduationCap },
    { to: '/words', label: 'Words', icon: BookOpen },
    ...(me?.isAdmin ? [{ to: '/import', label: 'Import', icon: Upload }] : []),
    { to: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2">
          <span className="mr-2 font-semibold tracking-tight">der·die·das</span>
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted',
                    isActive && 'bg-muted text-foreground',
                  )
                }
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          >
            {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            onClick={async () => {
              await authClient.signOut()
              queryClient.clear()
            }}
          >
            <LogOut />
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
