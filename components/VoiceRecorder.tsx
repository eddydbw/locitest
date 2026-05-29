'use client'
import { useRef, useState, useEffect } from 'react'

interface Props {
  onResult: (audioData: string | null) => void
  onSkip: () => void
}

export default function VoiceRecorder({ onResult, onSkip }: Props) {
  const [state, setState] = useState<'idle' | 'recording' | 'done' | 'unsupported'>('idle')
  const [seconds, setSeconds] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioData, setAudioData] = useState<string | null>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setState('unsupported'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const mr = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        // convert to base64 for storage
        const reader = new FileReader()
        reader.onloadend = () => setAudioData(reader.result as string)
        reader.readAsDataURL(blob)
        setState('done')
      }
      mr.start(100)
      mediaRef.current = mr
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
      setState('recording')
    } catch { setState('unsupported') }
  }

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRef.current?.stop()
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const btn = {
    padding: '13px 0', background: 'var(--card-bg)', border: '0.5px solid var(--border-strong)',
    borderRadius: 12, cursor: 'pointer', fontSize: 15, color: 'var(--text)', fontFamily: 'inherit', width: '100%',
  }

  if (state === 'unsupported') return (
    <div style={{ padding: '16px', background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 12, textAlign: 'center' }}>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12 }}>microphone not available on this device</p>
      <button onClick={onSkip} style={{ ...btn, width: 'auto', padding: '10px 20px' }}>skip</button>
    </div>
  )

  if (state === 'idle') return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={start} style={{ ...btn, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e24b4a', display: 'inline-block' }} />
        record
      </button>
      <button onClick={onSkip} style={{ ...btn, flex: 0, padding: '13px 20px', background: 'transparent', border: '0.5px solid var(--border)', color: 'var(--text-muted)' }}>
        skip
      </button>
    </div>
  )

  if (state === 'recording') return (
    <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e24b4a', display: 'inline-block', animation: 'pulse 1s infinite' }} />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>recording</span>
        </div>
        <span style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>{fmt(seconds)}</span>
      </div>
      <button onClick={stop} style={btn}>stop</button>
    </div>
  )

  // done state
  return (
    <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '16px' }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>listen back</p>
      {audioUrl && (
        <audio controls src={audioUrl} style={{ width: '100%', marginBottom: 14, height: 36 }} />
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onResult(audioData)}
          style={{ ...btn, flex: 2 }}
        >
          save this
        </button>
        <button
          onClick={() => { setAudioUrl(null); setAudioData(null); setState('idle') }}
          style={{ ...btn, flex: 1, background: 'transparent', border: '0.5px solid var(--border)', color: 'var(--text-muted)' }}
        >
          redo
        </button>
      </div>
    </div>
  )
}
