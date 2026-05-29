'use client'
import { useRef, useState } from 'react'

interface Props {
  onResult: (text: string) => void
  onSkip: () => void
}

export default function VoiceRecorder({ onResult, onSkip }: Props) {
  const [state, setState] = useState<'idle' | 'recording' | 'done' | 'text' | 'unsupported'>('idle')
  const [transcript, setTranscript] = useState('')
  const recogRef = useRef<SpeechRecognition | null>(null)

  const start = () => {
    const SR = (window as Window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      || (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SR) { setState('unsupported'); return }
    const r = new SR()
    r.continuous = true
    r.interimResults = true
    r.onresult = (e: SpeechRecognitionEvent) => {
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      setTranscript(t)
    }
    r.start()
    recogRef.current = r
    setState('recording')
  }

  const stop = () => {
    recogRef.current?.stop()
    setState('done')
  }

  const btn = {
    padding: '12px 0', background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 10,
    cursor: 'pointer', fontSize: 15, width: '100%', color: 'var(--text)',
  }
  const ghost = { ...btn, background: 'transparent', border: 'none', color: 'var(--text-muted)', width: 'auto', padding: '12px 16px' }

  if (state === 'unsupported' || state === 'text') return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
        {state === 'unsupported' ? "Voice not available — type instead:" : "Type your response:"}
      </p>
      <textarea
        value={transcript}
        onChange={e => setTranscript(e.target.value)}
        style={{ width: '100%', minHeight: 80, fontSize: 15, padding: '10px 12px', borderRadius: 10, border: '0.5px solid var(--border)', resize: 'none', boxSizing: 'border-box', background: 'var(--card-bg)', color: 'var(--text)', fontFamily: 'inherit' }}
        placeholder="type here…"
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={() => onResult(transcript)} style={{ ...btn, flex: 1 }}>done</button>
        <button onClick={onSkip} style={ghost}>skip</button>
      </div>
    </div>
  )

  if (state === 'idle') return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={start} style={{ ...btn, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>🎙</span> talk
      </button>
      <button onClick={() => setState('text')} style={{ ...btn, flex: 1 }}>type</button>
      <button onClick={onSkip} style={ghost}>skip</button>
    </div>
  )

  if (state === 'recording') return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e24b4a', display: 'inline-block', animation: 'pulse 1s infinite' }} />
        listening…
      </div>
      {transcript && <p style={{ fontSize: 15, lineHeight: 1.5, marginBottom: 12 }}>{transcript}</p>}
      <button onClick={stop} style={btn}>done talking</button>
    </div>
  )

  return (
    <div>
      <p style={{ fontSize: 15, lineHeight: 1.5, marginBottom: 12 }}>{transcript || '(nothing recorded)'}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onResult(transcript)} style={{ ...btn, flex: 1 }}>use this</button>
        <button onClick={() => { setTranscript(''); setState('idle') }} style={{ ...btn, flex: 1, background: 'transparent', color: 'var(--text-muted)' }}>redo</button>
      </div>
    </div>
  )
}
