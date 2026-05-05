import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/presentations',
]

const DEFAULT_APP_URL = 'https://dhautomation.vercel.app'

function getBaseUrl(request: NextRequest) {
  return (
    process.env.GOOGLE_OAUTH_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
    request.nextUrl.origin ||
    DEFAULT_APP_URL
  )
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID is not configured' }, { status: 500 })
  }

  const state = crypto.randomUUID()
  const baseUrl = getBaseUrl(request)
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || `${baseUrl}/api/oauth/google/callback`
  const scopes = (process.env.GOOGLE_OAUTH_SCOPES || DEFAULT_GOOGLE_SCOPES.join(' '))
    .split(/\s+/)
    .filter(Boolean)
  const next = request.nextUrl.searchParams.get('next') || '/'

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', scopes.join(' '))
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', state)

  const response = NextResponse.redirect(url)
  response.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    maxAge: 10 * 60,
    path: '/',
  })
  response.cookies.set('google_oauth_next', next, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    maxAge: 10 * 60,
    path: '/',
  })

  return response
}
