import { sql } from '@vercel/postgres'

export async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      session_id TEXT,
      prompt TEXT NOT NULL,
      category TEXT NOT NULL,
      photo_url TEXT,
      photo_data TEXT,
      audio_data TEXT,
      exchanges JSONB NOT NULL DEFAULT '[]',
      summary TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS cards_device_id_idx ON cards(device_id)
  `
  // add audio_data column if it doesn't exist (safe to run multiple times)
  await sql`ALTER TABLE cards ADD COLUMN IF NOT EXISTS audio_data TEXT`
}

export async function getOrCreateSession(deviceId: string) {
  const existing = await sql`
    SELECT id FROM sessions WHERE device_id = ${deviceId} ORDER BY created_at DESC LIMIT 1
  `
  if (existing.rows.length > 0) return existing.rows[0].id

  const { v4: uuidv4 } = await import('uuid')
  const id = uuidv4()
  await sql`INSERT INTO sessions (id, device_id) VALUES (${id}, ${deviceId})`
  return id
}

export async function saveCard(card: {
  id: string
  deviceId: string
  sessionId: string
  prompt: string
  category: string
  photoData?: string
  audioData?: string | null
  exchanges: Exchange[]
  summary?: string
}) {
  await sql`
    INSERT INTO cards (id, device_id, session_id, prompt, category, photo_data, audio_data, exchanges, summary)
    VALUES (
      ${card.id},
      ${card.deviceId},
      ${card.sessionId},
      ${card.prompt},
      ${card.category},
      ${card.photoData ?? null},
      ${card.audioData ?? null},
      ${JSON.stringify(card.exchanges)},
      ${card.summary ?? null}
    )
    ON CONFLICT (id) DO UPDATE SET
      exchanges = EXCLUDED.exchanges,
      audio_data = EXCLUDED.audio_data,
      summary = EXCLUDED.summary
  `
}

export async function getCards(deviceId: string) {
  const result = await sql`
    SELECT * FROM cards WHERE device_id = ${deviceId} ORDER BY created_at DESC
  `
  return result.rows
}

export interface Exchange {
  question: string
  audioData?: string | null
}
