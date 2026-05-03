import { NextResponse } from 'next/server'
import { hasDatabaseUrl } from '@/lib/db/neon'

export async function GET() {
  return NextResponse.json({
    ok: true,
    database: hasDatabaseUrl() ? 'configured' : 'missing_DATABASE_URL',
  })
}

