'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { PROMPTS, type Prompt } from '@/lib/prompts'
import type { Exchange } from '@/lib/db'

const CameraCapture = dynamic(() => import('@/components/CameraCapture'), { ssr: false })
const VoiceRecorder = dynamic(() => import('@/components/VoiceRecorder'), { ssr: false })

type Screen = 'home' | 'choose' | 'prompt' | 'question' | 'done' | 'cards'

interface Card {
  id: string
  prompt: string
  category: string
  photo_data?: string
  audio_data?: string
  exchanges: Exchange[]
  created_at: string
}

function getDeviceId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('loci_device_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('loci_device_id', id) }
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
  return <button onClick={onClick} style={s.back}>← back</button>
}

function AudioPlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    audioRef.current = new Audio(src)
    audioRef.current.onended = () => setPlaying(false)
    return () => { audioRef.current?.pause(); audioRef.current = null }
  }, [src])

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); audioRef.current.currentTime = 0; setPlaying(false) }
    else { audioRef.current.play(); setPlaying(true) }
  }

  return (
    <button onClick={toggle} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit' }}>
      {playing
        ? <><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e24b4a', display: 'inline-block', animation: 'pulse 1s infinite' }} /> stop</>
        : <><span style={{ fontSize: 16 }}>▶</span> play response</>
      }
    </button>
  )
}

export default function LociApp() {
  const [screen, setScreen] = useState<Screen>('home')
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [conversation, setConversation] = useState<{ role: 'user' | 'assistant'; text: string; image?: string }[]>([])
  const [currentQ, setCurrentQ] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [cards, setCards] = useState<Card[]>([])
  const [cardsLoading, setCardsLoading] = useState(false)
  const [expandedCard, setExpandedCard] = useState<Card | null>(null)
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
    id: string; prompt: string; category: string
    photoData?: string; audioData?: string | null; exchanges: Exchange[]
  }) => {
    await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cardData, deviceId: deviceIdRef.current, sessionId }),
    })
  }, [sessionId])

  const startSession = (p: Prompt) => {
    setPrompt(p); setPhoto(null); setConversation([])
    setCurrentQ(null); setScreen('prompt')
  }

  const handlePhoto = async (dataUrl: string) => {
    setPhoto(dataUrl); setShowCamera(false); setLoading(true)
    const history = [{ role: 'user' as const, text: `I took a photo for the prompt: "${prompt!.text}"`, image: dataUrl }]
    setConversation(history)
    try {
      const q = await askClaude(history)
      // strip DONE: prefix if Claude wraps up early
      setCurrentQ(q.startsWith('DONE:') ? q.replace('DONE:', '').trim() : q)
    } catch { setCurrentQ('What made you choose that?') }
    setScreen('question')
    setLoading(false)
  }

  const handleAudio = async (audioData: string | null) => {
    // save card with photo + question + audio, no further branching
    await persistCard({
      id: crypto.randomUUID(),
      prompt: prompt!.text,
      category: prompt!.category,
      photoData: photo ?? undefined,
      audioData,
      exchanges: [{ question: currentQ!, audioData }],
    })
    setScreen('done')
  }

  const handleSkip = async () => { await handleAudio(null) }

  const goToCards = () => { setScreen('cards'); loadCards() }
  const randomPrompt = () => startSession(PROMPTS[Math.floor(Math.random() * PROMPTS.length)])

  return (
    <main style={{ maxWidth: 440, margin: '0 auto', padding: '24px 18px 56px' }}>

      {/* HOME */}
      {screen === 'home' && (
        <div className="animate-slide">
          <div style={{ marginBottom: 36 }}>
            <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 4 }}>loci</h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>photo prompts · voice responses</p>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
            <button onClick={randomPrompt} style={{ ...s.btn, flex: 2 }}>random prompt</button>
            <button onClick={() => setScreen('choose')} style={{ ...s.btn, flex: 1, background: 'transparent', color: 'var(--text-muted)' }}>choose</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <p style={{ ...s.label, marginBottom: 0 }}>your cards</p>
            <button onClick={goToCards} style={{ ...s.ghost, fontSize: 13 }}>see all →</button>
          </div>
          <div onClick={goToCards} style={{ ...s.card, padding: '18px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 15, color: 'var(--text-muted)' }}>view saved cards</p>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
          </div>
        </div>
      )}

      {/* CHOOSE */}
      {screen === 'choose' && (
        <div className="animate-slide">
          <BackButton onClick={() => setScreen('home')} />
          <p style={{ ...s.label, marginBottom: 16 }}>choose a prompt</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PROMPTS.map(p => (
              <button key={p.id} onClick={() => startSession(p)} style={{ ...s.card, textAlign: 'left', padding: '14px 16px', cursor: 'pointer', background: 'var(--card-bg)', border: '0.5px solid var(--border)', width: '100%', fontFamily: 'inherit' }}>
                <p style={{ ...s.label }}>{p.category}</p>
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
          <p style={{ ...s.label }}>{prompt.category}</p>
          <p style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.3, marginBottom: 28, letterSpacing: '-0.01em' }}>{prompt.text}</p>
          {showCamera ? (
            <CameraCapture onCapture={d => { setPhoto(d); setShowCamera(false) }} onCancel={() => setShowCamera(false)} />
          ) : photo ? (
            <div>
              <img src={photo} alt="" style={{ width: '100%', borderRadius: 12, marginBottom: 12, maxHeight: 280, objectFit: 'cover' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowCamera(true)} style={{ ...s.btn, flex: 1, color: 'var(--text-muted)', background: 'transparent' }}>retake</button>
                <button onClick={() => handlePhoto(photo)} disabled={loading} style={{ ...s.btn, flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {loading ? <span className="spinner" /> : 'use this →'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button onClick={() => setShowCamera(true)} style={{ ...s.btn, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '20px 0' }}>
                <span style={{ fontSize: 20 }}>📷</span> take a photo
              </button>
              <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>or upload from your files</p>
              <label style={{ display: 'block', textAlign: 'center', cursor: 'pointer' }}>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                  const f = e.target.files?.[0]; if (!f) return
                  const r = new FileReader(); r.onload = ev => setPhoto(ev.target!.result as string); r.readAsDataURL(f)
                }} />
                <span style={{ fontSize: 14, color: 'var(--text-muted)', textDecoration: 'underline' }}>choose file</span>
              </label>
            </div>
          )}
        </div>
      )}

      {/* QUESTION + VOICE */}
      {screen === 'question' && (
        <div className="animate-slide">
          {photo && <img src={photo} alt="" style={{ width: '100%', borderRadius: 12, marginBottom: 24, maxHeight: 220, objectFit: 'cover' }} />}
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0' }}>
              <span className="spinner" /><span style={{ fontSize: 14, color: 'var(--text-muted)' }}>thinking…</span>
            </div>
          ) : (
            <>
              <p style={{ ...s.label, marginBottom: 10 }}>respond out loud</p>
              <p style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.35, marginBottom: 28, letterSpacing: '-0.01em' }}>{currentQ}</p>
              <VoiceRecorder onResult={handleAudio} onSkip={handleSkip} />
            </>
          )}
        </div>
      )}

      {/* DONE */}
      {screen === 'done' && (
        <div className="animate-slide" style={{ paddingTop: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 48, marginBottom: 20 }}>✓</p>
          <p style={{ fontSize: 20, fontWeight: 500, marginBottom: 8 }}>card saved</p>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 36 }}>prompt · photo · response</p>
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
            <BackButton onClick={() => setScreen('home')} />
            <p style={{ fontSize: 14, fontWeight: 500 }}>cards</p>
            <div style={{ width: 60 }} />
          </div>
          {cardsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><span className="spinner" /></div>
          ) : cards.length === 0 ? (
            <div style={{ ...s.card, padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>no cards yet — take a prompt to start</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cards.map(c => (
                <div key={c.id} onClick={() => setExpandedCard(c)} style={{ ...s.card, cursor: 'pointer' }}>
                  <div style={{ display: 'flex' }}>
                    {c.photo_data && <img src={c.photo_data} alt="" style={{ width: 72, height: 72, objectFit: 'cover', flexShrink: 0 }} />}
                    <div style={{ padding: '10px 12px', flex: 1, minWidth: 0 }}>
                      <p style={{ ...s.label }}>{c.category}</p>
                      <p style={{ fontSize: 13, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{c.prompt}</p>
                    </div>
                  </div>
                  <div style={{ borderTop: '0.5px solid var(--border)', padding: '6px 12px', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                    {c.audio_data && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>🎙 has audio</span>}
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
            <img src={expandedCard.photo_data} alt="" style={{ width: '100%', borderRadius: 12, marginBottom: 20, maxHeight: 320, objectFit: 'cover' }} />
          )}
          <p style={{ ...s.label }}>{expandedCard.category}</p>
          <p style={{ fontSize: 19, fontWeight: 500, lineHeight: 1.4, marginBottom: 28, letterSpacing: '-0.01em' }}>{expandedCard.prompt}</p>

          {(expandedCard.exchanges as Exchange[]).map((ex, i) => (
            <div key={i} style={{ marginBottom: 20 }}>
              <p style={{ ...s.label, marginBottom: 8 }}>question asked</p>
              <p style={{ fontSize: 16, lineHeight: 1.5, marginBottom: 12, fontWeight: 500 }}>{ex.question}</p>
              {ex.audioData
                ? <AudioPlayer src={ex.audioData} />
                : <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>no audio recorded</p>
              }
            </div>
          ))}

          {/* top-level audio_data fallback for older cards */}
          {!expandedCard.exchanges?.length && expandedCard.audio_data && (
            <div>
              <p style={{ ...s.label, marginBottom: 8 }}>voice response</p>
              <AudioPlayer src={expandedCard.audio_data} />
            </div>
          )}
        </div>
      )}
    </main>
  )
}
