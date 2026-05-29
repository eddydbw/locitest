import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { initDB } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token || token !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await initDB()
    const result = await sql`
      SELECT id, device_id, session_id, prompt, category,
             photo_data, audio_data, exchanges, summary, created_at
      FROM cards
      WHERE id = ${params.id}
    `
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ card: result.rows[0] })
  } catch (err) {
    console.error('Admin card detail error:', err)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
