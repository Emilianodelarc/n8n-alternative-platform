import { NextResponse } from 'next/server'
import { initializeDatabase } from '@/lib/db/workflows'
import { databaseNotConfiguredResponse, requireDatabaseUrl } from '@/lib/api/responses'

export async function POST() {
  if (!requireDatabaseUrl()) return databaseNotConfiguredResponse()

  try {
    await initializeDatabase()
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

