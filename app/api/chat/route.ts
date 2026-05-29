import { NextRequest, NextResponse } from 'next/server'
import { SYSTEM_PROMPT } from '@/lib/prompts'

export const runtime = 'nodejs'
export const maxDuration = 30

interface Message {
  role: 'user' | 'assistant'
  text: string
  image?: string
}

export async function POST(req: NextRequest) {
  try {
    const { conversation } = await req.json() as { conversation: Message[] }

    if (!conversation || conversation.length === 0) {
      return NextResponse.json({ error: 'No conversation provided' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const messages = conversation.map((turn, i) => {
      if (turn.role === 'user' && turn.image && i === 0) {
        return {
          role: 'user' as const,
          content: [
            {
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: 'image/jpeg' as const,
                data: turn.image.replace(/^data:image\/\w+;base64,/, ''),
              },
            },
            { type: 'text' as const, text: turn.text || 'I took this photo.' },
          ],
        }
      }
      return {
        role: turn.role,
        content: turn.text,
      }
    })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 256,
        system: SYSTEM_PROMPT,
        messages,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Anthropic API error:', error)
      return NextResponse.json({ error: 'Claude API error' }, { status: 502 })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text ?? 'What made you choose that?'
    return NextResponse.json({ text })
  } catch (err) {
    console.error('Chat route error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
