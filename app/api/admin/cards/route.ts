import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { initDB } from '@/lib/db'

export const runtime = 'nodejs'

const PAGE_SIZE = 50

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token || token !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const page = Math.max(0, Number(req.nextUrl.searchParams.get('page') ?? '0'))
  const offset = page * PAGE_SIZE

  try {
    await initDB()
    const result = await sql`
      SELECT id, device_id, session_id, prompt, category, exchanges, summary, created_at,
             (photo_data IS NOT NULL) AS has_photo,
             (audio_data IS NOT NULL) AS has_audio
      FROM cards
      ORDER BY created_at DESC
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `
    const countResult = await sql`SELECT COUNT(*) FROM cards`
    const total = Number(countResult.rows[0].count)

    return NextResponse.json({
      cards: result.rows,
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    })
  } catch (err) {
    console.error('Admin cards error:', err)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}