import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateSession, initDB } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    await initDB()
    const { deviceId } = await req.json()
    if (!deviceId) return NextResponse.json({ error: 'deviceId required' }, { status: 400 })

    const sessionId = await getOrCreateSession(deviceId)
    return NextResponse.json({ sessionId })
  } catch (err) {
    console.error('Session route error:', err)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}
