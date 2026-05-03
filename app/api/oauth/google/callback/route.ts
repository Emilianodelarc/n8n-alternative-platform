import { NextRequest, NextResponse } from 'next/server'
import { databaseNotConfiguredResponse, requireDatabaseUrl } from '@/lib/api/responses'
import { getSql } from '@/lib/db/neon'
import { initializeDatabase } from '@/lib/db/workflows'

function getBaseUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
}

function redirectWithStatus(request: NextRequest, next: string, status: 'success' | 'error', message?: string) {
  const url = new URL(next || '/', getBaseUrl(request))
  url.searchParams.set('google_oauth', status)
  if (message) url.searchParams.set('message', message)

  const response = NextResponse.redirect(url)
  response.cookies.delete('google_oauth_state')
  response.cookies.delete('google_oauth_next')
  return response
}

export async function GET(request: NextRequest) {
  if (!requireDatabaseUrl()) return databaseNotConfiguredResponse()

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required' }, { status: 500 })
  }

  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')
  const state = request.nextUrl.searchParams.get('state')
  const expectedState = request.cookies.get('google_oauth_state')?.value
  const next = request.cookies.get('google_oauth_next')?.value || '/'

  if (error) return redirectWithStatus(request, next, 'error', error)
  if (!code) return redirectWithStatus(request, next, 'error', 'Missing authorization code')
  if (!state || !expectedState || state !== expectedState) {
    return redirectWithStatus(request, next, 'error', 'Invalid OAuth state')
  }

  try {
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || `${getBaseUrl(request)}/api/oauth/google/callback`
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })
    const tokenData = await tokenResponse.json().catch(() => ({})) as Record<string, unknown>

    if (!tokenResponse.ok || typeof tokenData.access_token !== 'string') {
      return redirectWithStatus(request, next, 'error', `Token exchange failed: ${JSON.stringify(tokenData)}`)
    }

    await initializeDatabase()
    const sql = getSql()
    const now = new Date().toISOString()
    const expiresIn = typeof tokenData.expires_in === 'number' ? tokenData.expires_in : 3600
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
    const scope = typeof tokenData.scope === 'string' ? tokenData.scope : ''

    await sql`
      INSERT INTO credentials (id, name, service, config, created_at, updated_at)
      VALUES (
        ${crypto.randomUUID()},
        ${'Google OAuth'},
        ${'google'},
        ${JSON.stringify({
          credentialType: 'bearerToken',
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt,
          scope,
          provider: 'google',
        })}::jsonb,
        ${now},
        ${now}
      )
    `

    return redirectWithStatus(request, next, 'success')
  } catch (callbackError) {
    return redirectWithStatus(request, next, 'error', (callbackError as Error).message)
  }
}
