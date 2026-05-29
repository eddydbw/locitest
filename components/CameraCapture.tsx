'use client'
import { useRef, useState, useEffect, useCallback } from 'react'

interface Props {
  onCapture: (dataUrl: string) => void
  onCancel: () => void
}

export default function CameraCapture({ onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')

  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setReady(true)
      }
    } catch {
      setReady(false)
    }
  }, [])

  useEffect(() => {
    startCamera(facingMode)
    return () => streamRef.current?.getTracks().forEach(t => t.stop())
  }, [facingMode, startCamera])

  const capture = () => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    canvas.getContext('2d')!.drawImage(videoRef.current, 0, 0)
    streamRef.current?.getTracks().forEach(t => t.stop())
    onCapture(canvas.toDataURL('image/jpeg', 0.8))
  }

  return (
    <div style={{ position: 'relative', width: '100%', background: '#000', borderRadius: 16, overflow: 'hidden', aspectRatio: '3/4' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: ready ? 'block' : 'none' }}
      />
      {!ready && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#fff', fontSize: 14 }}>
          starting camera…
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24 }}>
        <button
          onClick={onCancel}
          style={{ background: 'rgba(0,0,0,0.5)', border: '1.5px solid rgba(255,255,255,0.4)', color: '#fff', borderRadius: 999, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}
        >
          cancel
        </button>
        <button
          onClick={capture}
          style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff', border: '4px solid rgba(255,255,255,0.5)', cursor: 'pointer' }}
          aria-label="take photo"
        />
        <button
          onClick={() => setFacingMode(m => m === 'environment' ? 'user' : 'environment')}
          style={{ background: 'rgba(0,0,0,0.5)', border: '1.5px solid rgba(255,255,255,0.4)', color: '#fff', borderRadius: 999, padding: '10px 16px', fontSize: 14, cursor: 'pointer' }}
        >
          flip
        </button>
      </div>
    </div>
  )
}
