import { NextResponse } from 'next/server'
import { hasDatabaseUrl } from '@/lib/db/neon'

export function databaseNotConfiguredResponse() {
  return NextResponse.json(
    {
      error: 'DATABASE_URL is not configured',
      hint: 'Install Neon from the Vercel Marketplace, then run `vercel env pull .env.local --yes` locally.',
    },
    { status: 503 }
  )
}

export function requireDatabaseUrl() {
  return hasDatabaseUrl()
}

