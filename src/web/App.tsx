import { Navigate, Route, Routes } from 'react-router'
import { Layout } from '@/components/layout'
import { authClient } from '@/lib/auth-client'
import Dashboard from '@/routes/dashboard'
import ImportPage from '@/routes/import'
import Login from '@/routes/login'
import SettingsPage from '@/routes/settings'
import Study from '@/routes/study'
import Words from '@/routes/words'

export default function App() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) return <div className="grid min-h-svh place-items-center text-muted-foreground">Loading…</div>
  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="study" element={<Study />} />
        <Route path="words" element={<Words />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
