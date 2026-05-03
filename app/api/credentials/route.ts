import { NextResponse } from 'next/server'
import { databaseNotConfiguredResponse, requireDatabaseUrl } from '@/lib/api/responses'
import { getSql } from '@/lib/db/neon'
import { initializeDatabase } from '@/lib/db/workflows'

type CredentialRow = {
  id: string
  name: string
  service: string
  config: Record<string, unknown>
  created_at: Date | string
  updated_at: Date | string
}

function mapCredential(row: CredentialRow) {
  return {
    id: row.id,
    name: row.name,
    service: row.service,
    config: row.config || {},
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

export async function GET() {
  if (!requireDatabaseUrl()) return databaseNotConfiguredResponse()

  try {
    await initializeDatabase()
    const sql = getSql()
    const rows = await sql`
      SELECT id, name, service, config, created_at, updated_at
      FROM credentials
      ORDER BY updated_at DESC
    ` as CredentialRow[]
    return NextResponse.json({ credentials: rows.map(mapCredential) })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!requireDatabaseUrl()) return databaseNotConfiguredResponse()

  try {
    const body = await request.json()
    await initializeDatabase()
    const now = new Date().toISOString()
    const sql = getSql()
    const rows = await sql`
      INSERT INTO credentials (id, name, service, config, created_at, updated_at)
      VALUES (
        ${body.id || crypto.randomUUID()},
        ${body.name || 'Untitled credential'},
        ${body.service || 'generic'},
        ${JSON.stringify(body.config || {})}::jsonb,
        ${body.createdAt || now},
        ${body.updatedAt || now}
      )
      RETURNING id, name, service, config, created_at, updated_at
    ` as CredentialRow[]
    return NextResponse.json({ credential: mapCredential(rows[0]) }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
