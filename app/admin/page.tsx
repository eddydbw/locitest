'use client'
import { useState, useRef, useEffect } from 'react'

interface Exchange {
  question: string
  audioData?: string | null
}

interface ListCard {
  id: string
  device_id: string
  session_id: string
  prompt: string
  category: string
  has_photo: boolean
  has_audio: boolean
  exchanges: Exchange[]
  summary?: string
  created_at: string
}

interface FullCard {
  id: string
  device_id: string
  session_id: string
  prompt: string
  category: string
  photo_data?: string
  audio_data?: string
  exchanges: Exchange[]
  summary?: string
  created_at: string
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
    if (playing) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setPlaying(false)
    } else {
      audioRef.current.play()
      setPlaying(true)
    }
  }

  return (
    <button
      onClick={toggle}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: playing ? '#fef2f2' : '#f5f5f3',
        border: `1px solid ${playing ? '#fca5a5' : '#d4d4d0'}`,
        borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
        fontSize: 13, color: '#1a1a18', fontFamily: 'inherit',
      }}
    >
      {playing
        ? <><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e24b4a', display: 'inline-block', animation: 'pulse 1s infinite' }} /> stop</>
        : <><span>▶</span> play response</>
      }
    </button>
  )
}

function DeviceShortId({ id }: { id: string }) {
  return (
    <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#f0ede6', padding: '2px 6px', borderRadius: 4 }}>
      {id.slice(0, 8)}
    </span>
  )
}

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [cards, setCards] = useState<ListCard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedCard, setExpandedCard] = useState<FullCard | null>(null)
  const [expandLoading, setExpandLoading] = useState(false)
  const [filterDevice, setFilterDevice] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const authHeader = (pw: string) => ({ Authorization: `Bearer ${pw}` })

  const applyPageResponse = (d: { cards: ListCard[]; page: number; total: number; totalPages: number }) => {
    setCards(d.cards || [])
    setPage(d.page ?? 0)
    setTotal(d.total ?? 0)
    setTotalPages(d.totalPages ?? 1)
  }

  const login = async () => {
    setLoading(true); setError('')
    try {
      const r = await fetch('/api/admin/cards?page=0', { headers: authHeader(password) })
      if (r.status === 401) { setError('Wrong password'); setLoading(false); return }
      applyPageResponse(await r.json())
      setAuthed(true)
    } catch { setError('Failed to connect') }
    setLoading(false)
  }

  const fetchPage = async (p: number) => {
    setLoading(true)
    setExpandedId(null)
    setExpandedCard(null)
    setFilterDevice(null)
    try {
      const r = await fetch(`/api/admin/cards?page=${p}`, { headers: authHeader(password) })
      applyPageResponse(await r.json())
    } catch {}
    setLoading(false)
  }

  const refresh = () => fetchPage(page)

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setExpandedCard(null)
      return
    }
    setExpandedId(id)
    setExpandedCard(null)
    setExpandLoading(true)
    try {
      const r = await fetch(`/api/admin/cards/${id}`, { headers: authHeader(password) })
      const d = await r.json()
      setExpandedCard(d.card ?? null)
    } catch {}
    setExpandLoading(false)
  }

  const devices = Array.from(new Set(cards.map(c => c.device_id)))
  const filtered = filterDevice ? cards.filter(c => c.device_id === filterDevice) : cards

  const input = {
    padding: '11px 14px', fontSize: 15, borderRadius: 10,
    border: '1px solid #d4d4d0', outline: 'none', fontFamily: 'inherit',
    background: '#fff', color: '#1a1a18', width: '100%', boxSizing: 'border-box' as const,
  }
  const btn = {
    padding: '11px 20px', fontSize: 14, borderRadius: 10, cursor: 'pointer',
    border: '1px solid #1a1a18', background: '#1a1a18', color: '#fff',
    fontFamily: 'inherit', fontWeight: 500,
  }
  const pageBtn = (disabled: boolean) => ({
    padding: '8px 16px', fontSize: 13, borderRadius: 8, cursor: disabled ? 'default' : 'pointer',
    border: '1px solid #d4d4d0', background: disabled ? '#f5f5f3' : '#fff',
    color: disabled ? '#a0a09a' : '#1a1a18', fontFamily: 'inherit',
  })

  if (!authed) return (
    <div style={{ minHeight: '100vh', background: '#f7f5f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      <div style={{ background: '#fff', borderRadius: 16, padding: '36px 32px', width: '100%', maxWidth: 360, border: '1px solid #e8e6e0' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4, letterSpacing: '-0.02em' }}>loci admin</h1>
        <p style={{ fontSize: 14, color: '#6b6b65', marginBottom: 24 }}>enter password to view cards</p>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()}
          placeholder="password"
          style={{ ...input, marginBottom: 12 }}
        />
        {error && <p style={{ fontSize: 13, color: '#e24b4a', marginBottom: 12 }}>{error}</p>}
        <button onClick={login} disabled={loading} style={{ ...btn, width: '100%' }}>
          {loading ? 'checking…' : 'enter'}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f7f5f0', fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      <div style={{ background: '#fff', borderBottom: '1px solid #e8e6e0', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>loci admin</h1>
          <p style={{ fontSize: 12, color: '#6b6b65', margin: 0 }}>
            {filtered.length} card{filtered.length !== 1 ? 's' : ''} on this page{filterDevice ? ' · filtered' : ''}
          </p>
        </div>
        <button onClick={refresh} disabled={loading} style={{ ...btn, background: 'transparent', color: '#1a1a18', fontSize: 13, padding: '8px 14px' }}>
          {loading ? 'refreshing…' : '↻ refresh'}
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>

        {devices.length > 1 && (
          <div style={{ marginBottom: 20, display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#6b6b65' }}>filter by device:</span>
            <button onClick={() => setFilterDevice(null)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid ' + (!filterDevice ? '#1a1a18' : '#d4d4d0'), background: !filterDevice ? '#1a1a18' : '#fff', color: !filterDevice ? '#fff' : '#1a1a18' }}>
              all ({cards.length})
            </button>
            {devices.map((d, i) => (
              <button key={d} onClick={() => setFilterDevice(d)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid ' + (filterDevice === d ? '#1a1a18' : '#d4d4d0'), background: filterDevice === d ? '#1a1a18' : '#fff', color: filterDevice === d ? '#fff' : '#1a1a18' }}>
                device {i + 1} ({cards.filter(c => c.device_id === d).length})
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'total cards', value: filterDevice ? filtered.length : total },
            { label: 'with audio', value: filtered.filter(c => c.has_audio || c.exchanges?.some(e => e.audioData)).length },
            { label: 'devices', value: devices.length },
          ].map(stat => (
            <div key={stat.label} style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '16px 18px' }}>
              <p style={{ fontSize: 24, fontWeight: 600, margin: '0 0 2px', letterSpacing: '-0.02em' }}>{stat.value}</p>
              <p style={{ fontSize: 12, color: '#6b6b65', margin: 0 }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 15, color: '#6b6b65' }}>no cards yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(card => {
              const isOpen = expandedId === card.id
              const showAudio = card.has_audio || card.exchanges?.some(e => e.audioData)
              const deviceIndex = devices.indexOf(card.device_id) + 1

              return (
                <div key={card.id} style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, overflow: 'hidden' }}>
                  {/* List row */}
                  <div onClick={() => toggleExpand(card.id)} style={{ display: 'flex', cursor: 'pointer' }}>
                    {card.has_photo
                      ? <div style={{ width: 80, height: 80, background: '#f0ede6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📷</div>
                      : <div style={{ width: 80, height: 80, background: '#f7f5f0', flexShrink: 0 }} />
                    }
                    <div style={{ padding: '12px 14px', flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: '#6b6b65', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{card.category}</span>
                        {showAudio && <span style={{ fontSize: 10 }}>🎙</span>}
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b6b65' }}>
                          {new Date(card.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p style={{ fontSize: 13, lineHeight: 1.4, margin: '0 0 6px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: isOpen ? 999 : 2, WebkitBoxOrient: 'vertical' as const }}>{card.prompt}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <DeviceShortId id={card.device_id} />
                        <span style={{ fontSize: 11, color: '#6b6b65' }}>device {deviceIndex}</span>
                      </div>
                    </div>
                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', color: '#6b6b65', fontSize: 12 }}>
                      {isOpen ? '▲' : '▼'}
                    </div>
                  </div>

                  {/* Expanded detail — fetched full card */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid #f0ede6', padding: '20px' }}>
                      {expandLoading && !expandedCard ? (
                        <p style={{ fontSize: 13, color: '#6b6b65' }}>loading…</p>
                      ) : expandedCard?.id === card.id ? (
                        <>
                          {expandedCard.photo_data && (
                            <img src={expandedCard.photo_data} alt="" style={{ width: '100%', borderRadius: 10, marginBottom: 20, maxHeight: 400, objectFit: 'contain', background: '#f7f5f0' }} />
                          )}
                          {expandedCard.exchanges?.length > 0 ? expandedCard.exchanges.map((ex, i) => (
                            <div key={i} style={{ marginBottom: 16 }}>
                              <p style={{ fontSize: 11, color: '#6b6b65', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>question asked</p>
                              <p style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.4, marginBottom: 10 }}>{ex.question}</p>
                              {ex.audioData
                                ? <AudioPlayer src={ex.audioData} />
                                : <p style={{ fontSize: 13, color: '#6b6b65', fontStyle: 'italic' }}>no audio recorded</p>
                              }
                            </div>
                          )) : expandedCard.audio_data ? (
                            <div>
                              <p style={{ fontSize: 11, color: '#6b6b65', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>voice response</p>
                              <AudioPlayer src={expandedCard.audio_data} />
                            </div>
                          ) : (
                            <p style={{ fontSize: 13, color: '#6b6b65', fontStyle: 'italic' }}>no response recorded</p>
                          )}
                          {expandedCard.summary && (
                            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0ede6' }}>
                              <p style={{ fontSize: 11, color: '#6b6b65', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>captured thought</p>
                              <p style={{ fontSize: 14, lineHeight: 1.5 }}>{expandedCard.summary}</p>
                            </div>
                          )}
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 28 }}>
            <button
              onClick={() => fetchPage(page - 1)}
              disabled={page === 0 || loading}
              style={pageBtn(page === 0 || loading)}
            >
              ← prev
            </button>
            <span style={{ fontSize: 13, color: '#6b6b65' }}>
              page {page + 1} of {totalPages} · {total} total
            </span>
            <button
              onClick={() => fetchPage(page + 1)}
              disabled={page >= totalPages - 1 || loading}
              style={pageBtn(page >= totalPages - 1 || loading)}
            >
              next →
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
