'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { PROMPTS, type Prompt } from '@/lib/prompts'
import type { Exchange } from '@/lib/db'

const CameraCapture = dynamic(() => import('@/components/CameraCapture'), { ssr: false })
const VoiceRecorder = dynamic(() => import('@/components/VoiceRecorder'), { ssr: false })

type Screen = 'home' | 'choose' | 'prompt' | 'question' | 'done' | 'cards' | 'card-detail'

interface Card {
  id: string
  device_id: string
  prompt: string
  category: string
  photo_data?: string
  exchanges: Exchange[]
  summary?: string
  created_at: string
}

function getDeviceId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('loci_device_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('loci_device_id', id)
  }
  return id
}

const s = {
  label: { fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 },
  btn: { width: '100%', padding: '13px 0', background: 'var(--card-bg)', border: '0.5px solid var(--border-strong)', borderRadius: 12, cursor: 'pointer', fontSize: 15, color: 'var(--text)', fontFamily: 'inherit' },
  ghost: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)', fontFamily: 'inherit', padding: '4px 0' },
  back: { display: 'flex' as const, alignItems: 'center' as const, gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)', fontFamily: 'inherit', padding: 0, marginBottom: 24 },
  card: { background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 12, overflow: 'hidden' as const },
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={s.back}>
      ← back
    </button>
  )
}

function CategoryTag({ cat }: { cat: string }) {
  return <p style={{ ...s.label, marginBottom: 8 }}>{cat}</p>
}

export default function LociApp() {
  const [screen, setScreen] = useState<Screen>('home')
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [conversation, setConversation] = useState<{ role: 'user' | 'assistant'; text: string; image?: string }[]>([])
  const [currentQ, setCurrentQ] = useState<string | null>(null)
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [loading, setLoading] = useState(false)
  const [cards, setCards] = useState<Card[]>([])
  const [cardsLoading, setCardsLoading] = useState(false)
  const [expandedCard, setExpandedCard] = useState<Card | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string>('')
  const deviceIdRef = useRef<string>('')

  useEffect(() => {
    deviceIdRef.current = getDeviceId()
    fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: deviceIdRef.current }),
    }).then(r => r.json()).then(d => setSessionId(d.sessionId)).catch(() => {})
  }, [])

  const loadCards = useCallback(async () => {
    if (!deviceIdRef.current) return
    setCardsLoading(true)
    try {
      const r = await fetch(`/api/cards?deviceId=${deviceIdRef.current}`)
      const d = await r.json()
      setCards(d.cards || [])
    } catch {}
    setCardsLoading(false)
  }, [])

  const askClaude = useCallback(async (history: typeof conversation) => {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation: history }),
    })
    const d = await r.json()
    return d.text as string
  }, [])

  const persistCard = useCallback(async (cardData: {
    id: string; prompt: string; category: string; photoData?: string;
    exchanges: Exchange[]; summary?: string;
  }) => {
    await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...cardData,
        deviceId: deviceIdRef.current,
        sessionId,
      }),
    })
  }, [sessionId])

  const startSession = (p: Prompt) => {
    setPrompt(p); setPhoto(null); setConversation([]); setExchanges([])
    setCurrentQ(null); setDone(null); setScreen('prompt')
  }

  const handlePhoto = async (dataUrl: string) => {
    setPhoto(dataUrl); setShowCamera(false); setLoading(true)
    const history = [{ role: 'user' as const, text: `I took a photo for the prompt: "${prompt!.text}"`, image: dataUrl }]
    setConversation(history)
    try {
      const q = await askClaude(history)
      if (q.startsWith('DONE:')) {
        const summary = q.replace('DONE:', '').trim()
        setDone(summary)
        await persistCard({ id: crypto.randomUUID(), prompt: prompt!.text, category: prompt!.category, photoData: dataUrl, exchanges: [], summary })
        setScreen('done')
      } else {
        setCurrentQ(q); setScreen('question')
      }
    } catch { setCurrentQ('What made you choose that?'); setScreen('question') }
    setLoading(false)
  }

  const handleResponse = async (responseText: string) => {
    const newExchange: Exchange = { question: currentQ!, response: responseText }
    const newExchanges = [...exchanges, newExchange]
    setExchanges(newExchanges)
    setLoading(true)
    const newHistory = [
      ...conversation,
      { role: 'assistant' as const, text: currentQ! },
      { role: 'user' as const, text: responseText || '(no response)' },
    ]
    setConversation(newHistory)
    try {
      const q = await askClaude(newHistory)
      if (q.startsWith('DONE:')) {
        const summary = q.replace('DONE:', '').trim()
        setDone(summary)
        await persistCard({ id: crypto.randomUUID(), prompt: prompt!.text, category: prompt!.category, photoData: photo ?? undefined, exchanges: newExchanges, summary })
        setScreen('done')
      } else {
        setCurrentQ(q); setScreen('question')
      }
    } catch { setCurrentQ('Can you say more about that?'); setScreen('question') }
    setLoading(false)
  }

  const finishEarly = async () => {
    await persistCard({ id: crypto.randomUUID(), prompt: prompt!.text, category: prompt!.category, photoData: photo ?? undefined, exchanges, summary: undefined })
    setScreen('cards'); loadCards()
  }

  const goToCards = () => { setScreen('cards'); loadCards() }

  const randomPrompt = () => startSession(PROMPTS[Math.floor(Math.random() * PROMPTS.length)])

  return (
    <main style={{ maxWidth: 440, margin: '0 auto', padding: '24px 18px 56px' }}>

      {/* HOME */}
      {screen === 'home' && (
        <div className="animate-slide">
          <div style={{ marginBottom: 36 }}>
            <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 4 }}>loci</h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>photo prompts · belief questions</p>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
            <button onClick={randomPrompt} style={{ ...s.btn, flex: 2 }}>random prompt</button>
            <button onClick={() => setScreen('choose')} style={{ ...s.btn, flex: 1, background: 'transparent', color: 'var(--text-muted)' }}>choose</button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <p style={{ ...s.label, marginBottom: 0 }}>your cards</p>
            <button onClick={goToCards} style={{ ...s.ghost, fontSize: 13 }}>see all →</button>
          </div>

          <div
            onClick={goToCards}
            style={{ ...s.card, padding: '18px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <p style={{ fontSize: 15, color: 'var(--text-muted)' }}>view saved cards</p>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
          </div>
        </div>
      )}

      {/* CHOOSE PROMPT */}
      {screen === 'choose' && (
        <div className="animate-slide">
          <BackButton onClick={() => setScreen('home')} />
          <p style={{ ...s.label, marginBottom: 16 }}>choose a prompt</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PROMPTS.map(p => (
              <button
                key={p.id}
                onClick={() => startSession(p)}
                style={{ ...s.card, textAlign: 'left', padding: '14px 16px', cursor: 'pointer', background: 'var(--card-bg)', border: '0.5px solid var(--border)', width: '100%', fontFamily: 'inherit' }}
              >
                <CategoryTag cat={p.category} />
                <p style={{ fontSize: 15, lineHeight: 1.4, color: 'var(--text)' }}>{p.text}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PROMPT + PHOTO */}
      {screen === 'prompt' && prompt && (
        <div className="animate-slide">
          <BackButton onClick={() => setScreen('home')} />
          <CategoryTag cat={prompt.category} />
          <p style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.3, marginBottom: 28, letterSpacing: '-0.01em' }}>{prompt.text}</p>

          {showCamera ? (
            <CameraCapture onCapture={d => { setPhoto(d); setShowCamera(false) }} onCancel={() => setShowCamera(false)} />
          ) : photo ? (
            <div>
              <img src={photo} alt="" style={{ width: '100%', borderRadius: 12, marginBottom: 12, maxHeight: 280, objectFit: 'cover' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowCamera(true)} style={{ ...s.btn, flex: 1, color: 'var(--text-muted)', background: 'transparent' }}>retake</button>
                <button
                  onClick={() => handlePhoto(photo)}
                  disabled={loading}
                  style={{ ...s.btn, flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {loading ? <span className="spinner" /> : 'use this →'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button
                onClick={() => setShowCamera(true)}
                style={{ ...s.btn, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '20px 0' }}
              >
                <span style={{ fontSize: 20 }}>📷</span> take a photo
              </button>
              <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>or upload from your files</p>
              <label style={{ display: 'block', textAlign: 'center', cursor: 'pointer' }}>
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    const r = new FileReader()
                    r.onload = ev => setPhoto(ev.target!.result as string)
                    r.readAsDataURL(f)
                  }}
                />
                <span style={{ fontSize: 14, color: 'var(--text-muted)', textDecoration: 'underline' }}>choose file</span>
              </label>
            </div>
          )}
        </div>
      )}

      {/* QUESTION + RESPONSE */}
      {screen === 'question' && (
        <div className="animate-slide">
          {photo && <img src={photo} alt="" style={{ width: '100%', borderRadius: 12, marginBottom: 24, maxHeight: 220, objectFit: 'cover' }} />}
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0' }}>
              <span className="spinner" />
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>thinking…</span>
            </div>
          ) : (
            <>
              <p style={{ ...s.label, marginBottom: 10 }}>question {exchanges.length + 1}</p>
              <p style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.35, marginBottom: 28, letterSpacing: '-0.01em' }}>{currentQ}</p>
              <VoiceRecorder onResult={handleResponse} onSkip={() => handleResponse('')} />
              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <button onClick={finishEarly} style={s.ghost}>end here</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* DONE */}
      {screen === 'done' && (
        <div className="animate-slide" style={{ paddingTop: 20 }}>
          {photo && <img src={photo} alt="" style={{ width: '100%', borderRadius: 12, marginBottom: 28, maxHeight: 260, objectFit: 'cover' }} />}
          <p style={{ ...s.label, marginBottom: 12, textAlign: 'center' }}>captured</p>
          <p style={{ fontSize: 20, fontWeight: 500, lineHeight: 1.4, marginBottom: 36, letterSpacing: '-0.01em', textAlign: 'center' }}>{done}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={goToCards} style={{ ...s.btn, flex: 1 }}>my cards</button>
            <button onClick={randomPrompt} style={{ ...s.btn, flex: 1, background: 'transparent', color: 'var(--text-muted)' }}>new prompt</button>
          </div>
        </div>
      )}

      {/* CARDS LIST */}
      {screen === 'cards' && !expandedCard && (
        <div className="animate-slide">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <button onClick={() => setScreen('home')} style={s.back}>← home</button>
            <p style={{ fontSize: 14, fontWeight: 500 }}>cards</p>
            <div style={{ width: 60 }} />
          </div>

          {cardsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <span className="spinner" />
            </div>
          ) : cards.length === 0 ? (
            <div style={{ ...s.card, padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>no cards yet — take a prompt to start</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cards.map(c => (
                <div
                  key={c.id}
                  onClick={() => { setExpandedCard(c) }}
                  style={{ ...s.card, cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex' }}>
                    {c.photo_data && (
                      <img src={c.photo_data} alt="" style={{ width: 72, height: 72, objectFit: 'cover', flexShrink: 0 }} />
                    )}
                    <div style={{ padding: '10px 12px', flex: 1, minWidth: 0 }}>
                      <CategoryTag cat={c.category} />
                      <p style={{ fontSize: 13, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{c.prompt}</p>
                      {c.summary && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>{c.summary}</p>}
                    </div>
                  </div>
                  <div style={{ borderTop: '0.5px solid var(--border)', padding: '6px 12px', display: 'flex', gap: 12 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {(c.exchanges as Exchange[]).length} exchange{(c.exchanges as Exchange[]).length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CARD DETAIL */}
      {screen === 'cards' && expandedCard && (
        <div className="animate-slide">
          <BackButton onClick={() => setExpandedCard(null)} />
          {expandedCard.photo_data && (
            <img src={expandedCard.photo_data} alt="" style={{ width: '100%', borderRadius: 12, marginBottom: 20, maxHeight: 280, objectFit: 'cover' }} />
          )}
          <CategoryTag cat={expandedCard.category} />
          <p style={{ fontSize: 19, fontWeight: 500, lineHeight: 1.4, marginBottom: 28, letterSpacing: '-0.01em' }}>{expandedCard.prompt}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {(expandedCard.exchanges as Exchange[]).map((ex, i) => (
              <div key={i}>
                <p style={{ ...s.label, marginBottom: 8 }}>Q{i + 1}</p>
                <p style={{ fontSize: 16, lineHeight: 1.5, marginBottom: ex.response ? 10 : 0, fontWeight: 500 }}>{ex.question}</p>
                {ex.response && (
                  <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 14px', borderLeft: '2px solid var(--border-strong)' }}>
                    <p style={{ fontSize: 14, lineHeight: 1.6, fontStyle: 'italic' }}>"{ex.response}"</p>
                  </div>
                )}
              </div>
            ))}
            {expandedCard.summary && (
              <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 20 }}>
                <p style={{ ...s.label, marginBottom: 8 }}>captured thought</p>
                <p style={{ fontSize: 16, lineHeight: 1.5 }}>{expandedCard.summary}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
