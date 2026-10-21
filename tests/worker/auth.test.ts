import { resolveDynamicBaseURL } from 'better-auth'
import { describe, expect, it } from 'vitest'
import { authUrls } from '../../src/worker/auth'

const prod = authUrls({
  BETTER_AUTH_URL: 'https://der-die-das.joaomiguel.com.br, https://der-die-das.joaobohn.com.br,https://sprache-lernen.joao-miguel-bohn.workers.dev/',
})
const resolve = (url: string, config = prod.baseURL) => resolveDynamicBaseURL(config, new Request(url), '/api/auth')

describe('authUrls', () => {
  it('builds the callback base from the domain the sign-in started on', () => {
    expect(resolve('https://der-die-das.joaomiguel.com.br/api/auth/sign-in/social')).toBe('https://der-die-das.joaomiguel.com.br/api/auth')
    expect(resolve('https://der-die-das.joaobohn.com.br/api/auth/sign-in/social')).toBe('https://der-die-das.joaobohn.com.br/api/auth')
    expect(resolve('https://sprache-lernen.joao-miguel-bohn.workers.dev/api/auth/sign-in/social')).toBe(
      'https://sprache-lernen.joao-miguel-bohn.workers.dev/api/auth',
    )
  })

  it('falls back to the first origin for hosts that are not listed', () => {
    expect(resolve('https://evil.example/api/auth/sign-in/social')).toBe('https://der-die-das.joaomiguel.com.br/api/auth')
  })

  it('trusts exactly the listed origins, without trailing slashes', () => {
    expect(prod.trustedOrigins).toEqual([
      'https://der-die-das.joaomiguel.com.br',
      'https://der-die-das.joaobohn.com.br',
      'https://sprache-lernen.joao-miguel-bohn.workers.dev',
    ])
  })

  it('keeps a single localhost origin working for development', () => {
    const dev = authUrls({ BETTER_AUTH_URL: 'http://localhost:5173' })
    expect(resolve('http://localhost:5173/api/auth/sign-in/social', dev.baseURL)).toBe('http://localhost:5173/api/auth')
  })
})
