import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authClient } from '@/lib/auth-client'

export default function Login() {
  const [loading, setLoading] = useState(false)
  return (
    <div className="grid min-h-svh place-items-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">der · die · das</CardTitle>
          <CardDescription>Learn German nouns together with their articles.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            disabled={loading}
            onClick={() => {
              setLoading(true)
              void authClient.signIn.social({ provider: 'google', callbackURL: '/' })
            }}
          >
            {loading ? 'Redirecting…' : 'Continue with Google'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
