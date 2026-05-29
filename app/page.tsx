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
  label: { fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 },
  btn: { width: '100%', padding: '13px 0', background: 'var(--card-bg)', border: '2px solid var(--border-strong)', borderRadius: 16, cursor: 'pointer', fontSize: 15, color: 'var(--text)' },
  ghost: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)', padding: '4px 0' },
  back: { display: 'flex' as const, alignItems: 'center' as const, gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)', padding: 0, marginBottom: 24 },
  card: { background: 'var(--card-bg)', border: '2px solid var(--border)', borderRadius: 16, overflow: 'hidden' as const },
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <button
        onClick={onClick}
        className="circle-btn"
        aria-label="go back"
        style={{
          width: 44, height: 44,
          background: 'white',
          border: '2px solid var(--border)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          color: 'var(--text-muted)',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
      </button>
    </div>
  )
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
    <button onClick={toggle} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', border: '2px solid var(--border)', borderRadius: 12, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
      {playing
        ? <><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF2D78', display: 'inline-block', animation: 'pulse 1s infinite' }} /> stop</>
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
      setCurrentQ(q.startsWith('DONE:') ? q.replace('DONE:', '').trim() : q)
    } catch { setCurrentQ('What made you choose that?') }
    setScreen('question')
    setLoading(false)
  }

  const handleAudio = async (audioData: string | null) => {
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
    <main>

      {/* HOME — full-page centred */}
      {screen === 'home' && (
        <div className="animate-slide" style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: 24,
          textAlign: 'center',
        }}>

          {/* Saved cards icon — top right */}
          <button
            onClick={goToCards}
            className="circle-btn"
            title="Saved cards"
            style={{
              position: 'absolute', top: 20, right: 20,
              width: 48, height: 48,
              background: '#7C3AED',
              boxShadow: '0 4px 14px rgba(124,58,237,0.4)',
              color: 'white',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="16" height="13" rx="2"/>
              <path d="M6 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"/>
            </svg>
          </button>

          {/* Title */}
          <h1 style={{
            fontFamily: 'Mansalva, cursive',
            fontSize: 80,
            color: '#FF2D78',
            lineHeight: 1,
            marginBottom: 56,
            letterSpacing: '0.02em',
          }}>
            Loci
          </h1>

          {/* Button cluster */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            {/* Big random prompt circle */}
            <button
              onClick={randomPrompt}
              className="circle-btn"
              style={{
                width: 200, height: 200,
                background: '#FFD700',
                boxShadow: '0 8px 28px rgba(255,215,0,0.55)',
                fontSize: 22,
                color: '#2D1B69',
                flexDirection: 'column',
                lineHeight: 1.25,
                textAlign: 'center',
              }}
            >
              random<br />prompt
            </button>

            {/* Small choose circle — bottom right of big button */}
            <button
              onClick={() => setScreen('choose')}
              className="circle-btn"
              style={{
                position: 'absolute', bottom: -16, right: -16,
                width: 82, height: 82,
                background: '#FF6B35',
                boxShadow: '0 4px 16px rgba(255,107,53,0.5)',
                fontSize: 18,
                color: 'white',
              }}
            >
              choose
            </button>
          </div>
        </div>
      )}

      {/* All other screens — constrained container */}
      {screen !== 'home' && (
        <div style={{ maxWidth: 440, margin: '0 auto', padding: '24px 18px 56px' }}>

          {/* CHOOSE */}
          {screen === 'choose' && (
            <div className="animate-slide">
              <BackButton onClick={() => setScreen('home')} />
              <p style={{ ...s.label, marginBottom: 16 }}>choose a prompt</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {PROMPTS.map(p => (
                  <button key={p.id} onClick={() => startSession(p)} style={{ ...s.card, textAlign: 'left', padding: '14px 16px', cursor: 'pointer', background: 'var(--card-bg)', border: '2px solid var(--border)', width: '100%' }}>
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
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <p style={{ ...s.label, textAlign: 'center', marginBottom: 10 }}>{prompt.category}</p>
                <p style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.3 }}>{prompt.text}</p>
              </div>
              {showCamera ? (
                <CameraCapture onCapture={d => { setPhoto(d); setShowCamera(false) }} onCancel={() => setShowCamera(false)} />
              ) : photo ? (
                <div>
                  <img src={photo} alt="" style={{ width: '100%', borderRadius: 16, marginBottom: 12, maxHeight: 280, objectFit: 'cover' }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowCamera(true)} style={{ ...s.btn, flex: 1, color: 'var(--text-muted)', background: 'transparent' }}>retake</button>
                    <button onClick={() => handlePhoto(photo)} disabled={loading} style={{ ...s.btn, flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#FFD700', border: 'none', color: '#2D1B69' }}>
                      {loading ? <span className="spinner" /> : 'use this →'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button
                    onClick={() => setShowCamera(true)}
                    className="circle-btn"
                    aria-label="take a photo"
                    style={{
                      width: 120, height: 120,
                      background: '#FFD700',
                      boxShadow: '0 6px 22px rgba(255,215,0,0.5)',
                      color: '#2D1B69',
                    }}
                  >
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* QUESTION + VOICE */}
          {screen === 'question' && (
            <div className="animate-slide">
              {photo && <img src={photo} alt="" style={{ width: '100%', borderRadius: 16, marginBottom: 24, maxHeight: 220, objectFit: 'cover' }} />}
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0' }}>
                  <span className="spinner" /><span style={{ fontSize: 14, color: 'var(--text-muted)' }}>thinking…</span>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.35, marginBottom: 28 }}>{currentQ}</p>
                  <VoiceRecorder onResult={handleAudio} onSkip={handleSkip} />
                </>
              )}
            </div>
          )}

          {/* DONE */}
          {screen === 'done' && (
            <div className="animate-slide animate-pop" style={{ paddingTop: 60, textAlign: 'center' }}>
              <p style={{ fontSize: 64, marginBottom: 16 }}>✓</p>
              <p style={{ fontSize: 22, fontWeight: 600, marginBottom: 48, color: '#7C3AED' }}>card saved</p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button onClick={goToCards} style={{ ...s.btn, width: 'auto', padding: '13px 28px', background: '#7C3AED', border: 'none', color: 'white', borderRadius: 40 }}>my cards</button>
                <button onClick={randomPrompt} style={{ ...s.btn, width: 'auto', padding: '13px 28px', background: '#FFD700', border: 'none', color: '#2D1B69', borderRadius: 40 }}>new prompt</button>
              </div>
            </div>
          )}

          {/* CARDS LIST */}
          {screen === 'cards' && !expandedCard && (
            <div className="animate-slide">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <BackButton onClick={() => setScreen('home')} />
                <p style={{ fontSize: 16, fontWeight: 600, color: '#7C3AED' }}>cards</p>
                <div style={{ width: 60 }} />
              </div>
              {cardsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><span className="spinner" /></div>
              ) : cards.length === 0 ? (
                <div style={{ ...s.card, padding: '40px 20px', textAlign: 'center' }}>
                  <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>no cards yet — take a prompt to start</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {cards.map(c => (
                    <div key={c.id} onClick={() => setExpandedCard(c)} style={{ ...s.card, cursor: 'pointer' }}>
                      <div style={{ display: 'flex' }}>
                        {c.photo_data && <img src={c.photo_data} alt="" style={{ width: 72, height: 72, objectFit: 'cover', flexShrink: 0 }} />}
                        <div style={{ padding: '10px 12px', flex: 1, minWidth: 0 }}>
                          <p style={{ ...s.label }}>{c.category}</p>
                          <p style={{ fontSize: 13, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{c.prompt}</p>
                        </div>
                      </div>
                      <div style={{ borderTop: '1px solid var(--border)', padding: '6px 12px', display: 'flex', gap: 12, alignItems: 'center' }}>
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
                <img src={expandedCard.photo_data} alt="" style={{ width: '100%', borderRadius: 16, marginBottom: 20, maxHeight: 320, objectFit: 'cover' }} />
              )}
              <p style={{ ...s.label }}>{expandedCard.category}</p>
              <p style={{ fontSize: 19, fontWeight: 500, lineHeight: 1.4, marginBottom: 28 }}>{expandedCard.prompt}</p>

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

              {!expandedCard.exchanges?.length && expandedCard.audio_data && (
                <div>
                  <p style={{ ...s.label, marginBottom: 8 }}>voice response</p>
                  <AudioPlayer src={expandedCard.audio_data} />
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </main>
  )
}
