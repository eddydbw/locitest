import { NextRequest, NextResponse } from 'next/server'
import { saveCard, getCards, initDB } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    await initDB()
    const deviceId = req.nextUrl.searchParams.get('deviceId')
    if (!deviceId) return NextResponse.json({ error: 'deviceId required' }, { status: 400 })

    const cards = await getCards(deviceId)
    return NextResponse.json({ cards })
  } catch (err) {
    console.error('GET /api/cards error:', err)
    return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDB()
    const body = await req.json()
    const { id, deviceId, sessionId, prompt, category, photoData, exchanges, summary } = body

    if (!id || !deviceId || !prompt || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await saveCard({ id, deviceId, sessionId, prompt, category, photoData, exchanges, summary })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/cards error:', err)
    return NextResponse.json({ error: 'Failed to save card' }, { status: 500 })
  }
}
