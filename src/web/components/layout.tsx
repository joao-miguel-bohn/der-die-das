import { useQueryClient } from '@tanstack/react-query'
import { BookOpen, GraduationCap, LayoutDashboard, LogOut, Moon, Settings, Sun, Upload, Users } from 'lucide-react'
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
    ...(me?.isAdmin
      ? [
          { to: '/import', label: 'Import', icon: Upload },
          { to: '/users', label: 'Users', icon: Users },
        ]
      : []),
    { to: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2">
          <span className="mr-2 font-semibold tracking-tight">der·die·das</span>
          <nav className="hidden flex-1 gap-1 lg:flex">
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
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex-1 lg:hidden" />
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
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-24 lg:pb-6">
        <Outlet />
      </main>
      {/* Phones and tablets get a bottom tab bar: the header has no room for every link. */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t bg-background/90 backdrop-blur lg:hidden">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5 py-2 text-[11px] font-medium text-muted-foreground',
                isActive && 'text-foreground',
              )
            }
          >
            <Icon className="size-5" />
            <span className="max-w-full truncate">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
