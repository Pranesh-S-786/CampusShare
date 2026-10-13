import { useState, useEffect, useRef, useCallback } from 'react'
import {
  X,
  Camera,
  KeyRound,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react'
import jsQR from 'jsqr'
import {
  type Booking,
  verifyHandover,
} from '../../services/api'

interface HandoverScanModalProps {
  booking: Booking | null
  actionType: 'pickup' | 'return'
  isOpen: boolean
  onClose: () => void
  onSuccess: (updatedBooking: Booking) => void
}

export function HandoverScanModal({
  booking,
  actionType,
  isOpen,
  onClose,
  onSuccess,
}: HandoverScanModalProps) {
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera')
  const [manualCode, setManualCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  // Camera references
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const isScanningRef = useRef<boolean>(false)

  const stopCamera = useCallback(() => {
    isScanningRef.current = false
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const handleVerifyToken = useCallback(async (tokenString: string) => {
    if (!booking) return
    setIsSubmitting(true)
    setError(null)
    stopCamera()

    try {
      const res = await verifyHandover(booking.id, {
        action_type: actionType,
        token: tokenString.trim(),
      })
      setIsSuccess(true)
      setTimeout(() => {
        onSuccess(res.booking)
        onClose()
      }, 1500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to verify handover code.')
      // Allow retry or switch to manual tab
      setActiveTab('manual')
    } finally {
      setIsSubmitting(false)
    }
  }, [booking, actionType, stopCamera, onSuccess, onClose])

  const tickScanner = useCallback(() => {
    if (!isScanningRef.current || !videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        })

        if (code && code.data) {
          isScanningRef.current = false
          handleVerifyToken(code.data)
          return
        }
      }
    }

    if (isScanningRef.current) {
      animFrameRef.current = requestAnimationFrame(tickScanner)
    }
  }, [handleVerifyToken])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    setError(null)
    isScanningRef.current = false

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not supported or requires a secure HTTPS connection.')
      setActiveTab('manual')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute('playsinline', 'true')
        await videoRef.current.play()
        isScanningRef.current = true
        animFrameRef.current = requestAnimationFrame(tickScanner)
      }
    } catch (err: unknown) {
      console.warn('Camera stream error:', err)
      setCameraError('Camera access was denied or is unavailable on this device.')
      setActiveTab('manual')
    }
  }, [tickScanner])

  useEffect(() => {
    if (isOpen && activeTab === 'camera' && !isSuccess) {
      startCamera()
    } else {
      stopCamera()
    }

    return () => {
      stopCamera()
    }
  }, [isOpen, activeTab, isSuccess, startCamera, stopCamera])

  if (!isOpen || !booking) return null

  const isPickup = actionType === 'pickup'
  const presenter = isPickup ? booking.lender : booking.borrower
  const presenterRole = isPickup ? 'Lender' : 'Borrower'

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualCode.trim()) {
      setError('Please enter the 6-character backup code or raw token.')
      return
    }
    handleVerifyToken(manualCode)
  }

  // Timeline computation
  const getTimelineSteps = () => {
    return [
      { id: 1, title: 'Requested', done: true },
      { id: 2, title: 'Accepted', done: true },
      {
        id: 3,
        title: 'Picked Up',
        done: booking.status === 'active' || booking.status === 'returned' || booking.status === 'completed',
        current: isPickup,
      },
      {
        id: 4,
        title: 'Returned',
        done: booking.status === 'returned' || booking.status === 'completed',
        current: !isPickup,
      },
      { id: 5, title: 'Completed', done: booking.status === 'completed' },
    ]
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white border border-stone-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 flex flex-col max-h-[94vh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-100 bg-[#FBF8F3]">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-900 flex items-center justify-center font-bold shrink-0">
              <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-800" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-stone-900 truncate">
                {isPickup ? 'Scan Pickup QR Code' : 'Scan Return QR Code'}
              </h3>
              <p className="text-[11px] sm:text-xs text-stone-500 truncate">
                {isPickup ? `Confirm item collection from ${presenter.full_name || presenter.username}` : `Confirm item return from ${presenter.full_name || presenter.username}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timeline Indicator */}
        <div className="px-6 py-2.5 bg-stone-50 border-b border-stone-100">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase font-mono tracking-wider text-stone-400">
            {getTimelineSteps().map((step, idx) => (
              <div key={step.id} className="flex items-center space-x-1">
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${
                    step.done
                      ? 'bg-[#1B3B2B] text-white'
                      : step.current
                      ? 'bg-amber-400 text-stone-900 ring-2 ring-amber-200'
                      : 'bg-stone-200 text-stone-500'
                  }`}
                >
                  {step.id}
                </span>
                <span
                  className={`hidden sm:inline ${
                    step.done ? 'text-stone-800' : step.current ? 'text-amber-800 font-bold' : ''
                  }`}
                >
                  {step.title}
                </span>
                {idx < 4 && <span className="text-stone-300 ml-1">›</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-4 flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === 'camera'
                ? 'bg-[#1B3B2B] text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200/60'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera Scanner</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === 'manual'
                ? 'bg-[#1B3B2B] text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200/60'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Enter Backup Code</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Success State */}
          {isSuccess ? (
            <div className="py-8 text-center space-y-3 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-9 h-9 text-emerald-700" />
              </div>
              <h4 className="text-base font-bold text-stone-900">
                {isPickup ? 'Handover Confirmed!' : 'Return Confirmed!'}
              </h4>
              <p className="text-xs text-stone-600 max-w-xs mx-auto">
                {isPickup
                  ? 'Your pickup was verified and recorded. The rental is now active.'
                  : 'The return was verified and recorded. The item has been safely returned.'}
              </p>
            </div>
          ) : isSubmitting ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-800 animate-spin mx-auto" />
              <p className="text-xs text-stone-600 font-semibold">Verifying cryptographic token with backend...</p>
            </div>
          ) : activeTab === 'camera' ? (
            <div className="space-y-4">
              {/* Camera Viewfinder */}
              <div className="relative aspect-square max-w-[280px] mx-auto rounded-3xl overflow-hidden bg-stone-900 border-2 border-emerald-900/30 shadow-lg flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Corner guide overlay */}
                <div className="absolute inset-6 border-2 border-emerald-400/80 rounded-2xl pointer-events-none flex flex-col justify-between p-2">
                  <div className="flex justify-between">
                    <span className="w-4 h-4 border-t-2 border-l-2 border-white rounded-tl-sm" />
                    <span className="w-4 h-4 border-t-2 border-r-2 border-white rounded-tr-sm" />
                  </div>
                  <div className="text-center text-[10px] font-bold text-white/90 font-mono tracking-wider bg-black/40 py-0.5 rounded-full backdrop-blur-2xs">
                    Align QR in frame
                  </div>
                  <div className="flex justify-between">
                    <span className="w-4 h-4 border-b-2 border-l-2 border-white rounded-bl-sm" />
                    <span className="w-4 h-4 border-b-2 border-r-2 border-white rounded-br-sm" />
                  </div>
                </div>
              </div>

              {cameraError && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5 text-center">
                  <p className="font-bold">{cameraError}</p>
                  <p className="text-[11px] text-amber-800">
                    Switch to the manual code tab to type the 6-character backup code shown on the {presenterRole.toLowerCase()}'s screen.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('manual')}
                    className="mt-1 px-3.5 py-1 rounded-lg text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 cursor-pointer"
                  >
                    Enter Code Instead
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Manual Backup Code Entry */
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                <label className="block text-xs font-bold text-stone-800">
                  Enter 6-Character Handover Code
                </label>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Ask {presenter.full_name || presenter.username} ({presenterRole.toLowerCase()}) to read the 6-character code displayed below their QR code.
                </p>
                <input
                  type="text"
                  maxLength={64}
                  placeholder="e.g. AB3K9P"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 text-center font-mono text-lg font-bold tracking-widest text-[#1B3B2B] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3B2B]/20 focus:border-[#1B3B2B]"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !manualCode.trim()}
                className="w-full py-2.5 px-4 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] disabled:opacity-50 transition-all shadow-sm cursor-pointer"
              >
                Verify & Confirm Handover
              </button>
            </form>
          )}

          {error && activeTab === 'camera' && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 text-center text-[10px] text-stone-500 flex items-center justify-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>Secure peer verification backed by single-use token hashing</span>
          </div>
        </div>
      </div>
    </div>
  )
}
