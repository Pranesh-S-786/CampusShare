import { useState, useEffect, useRef, useCallback } from 'react'
import {
  X,
  QrCode,
  ShieldCheck,
  Clock,
  RotateCcw,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import QRCode from 'qrcode'
import {
  type Booking,
  type HandoverQRData,
  generateHandoverQR,
  getBookingDetail,
} from '../../services/api'

interface HandoverQRModalProps {
  booking: Booking | null
  actionType: 'pickup' | 'return'
  isOpen: boolean
  onClose: () => void
  onHandoverCompleted?: (updatedBooking: Booking) => void
}

export function HandoverQRModal({
  booking,
  actionType,
  isOpen,
  onClose,
  onHandoverCompleted,
}: HandoverQRModalProps) {
  const [qrData, setQrData] = useState<HandoverQRData | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0)
  const [isSuccess, setIsSuccess] = useState(false)

  const pollingRef = useRef<number | null>(null)

  const loadQR = useCallback(async () => {
    if (!booking) return
    setIsLoading(true)
    setError(null)
    setIsSuccess(false)
    try {
      const data = await generateHandoverQR(booking.id, actionType)
      setQrData(data)

      // Generate Data URL using qrcode package
      const url = await QRCode.toDataURL(data.qr_payload, {
        width: 320,
        margin: 2,
        color: {
          dark: '#1B3B2B',
          light: '#FFFFFF',
        },
      })
      setQrDataUrl(url)

      // Compute seconds remaining
      const expiry = new Date(data.expires_at).getTime()
      const now = Date.now()
      setSecondsRemaining(Math.max(0, Math.floor((expiry - now) / 1000)))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate QR code.')
    } finally {
      setIsLoading(false)
    }
  }, [booking, actionType])

  useEffect(() => {
    if (isOpen && booking) {
      loadQR()
    } else {
      setQrData(null)
      setQrDataUrl('')
      setIsSuccess(false)
    }
  }, [isOpen, booking, loadQR])

  // Countdown timer effect
  useEffect(() => {
    if (!isOpen || secondsRemaining <= 0) return

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isOpen, secondsRemaining])

  // Poll for completion by the scanning peer
  useEffect(() => {
    if (!isOpen || !booking || isSuccess) return

    const pollBooking = async () => {
      try {
        const updated = await getBookingDetail(booking.id)
        if (actionType === 'pickup' && (updated.status === 'active' || updated.status === 'completed')) {
          setIsSuccess(true)
          if (onHandoverCompleted) onHandoverCompleted(updated)
        } else if (actionType === 'return' && (updated.status === 'returned' || updated.status === 'completed')) {
          setIsSuccess(true)
          if (onHandoverCompleted) onHandoverCompleted(updated)
        }
      } catch {
        // silent polling catch
      }
    }

    pollingRef.current = window.setInterval(pollBooking, 2500)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [isOpen, booking, actionType, isSuccess, onHandoverCompleted])

  if (!isOpen || !booking) return null

  const isPickup = actionType === 'pickup'
  const partnerStudent = isPickup ? booking.borrower : booking.lender
  const partnerRole = isPickup ? 'Borrower' : 'Lender'

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const remSecs = secs % 60
    return `${mins}:${remSecs < 10 ? '0' : ''}${remSecs}`
  }

  const handleCopyCode = () => {
    if (qrData?.verification_code) {
      navigator.clipboard.writeText(qrData.verification_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white border border-stone-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 flex flex-col max-h-[94vh] sm:max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-100 bg-[#FBF8F3]">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-900 flex items-center justify-center font-bold shrink-0">
              <QrCode className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-800" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-stone-900 truncate">
                {isPickup ? 'Present Pickup QR' : 'Present Return QR'}
              </h3>
              <p className="text-[11px] sm:text-xs text-stone-500 truncate">
                {isPickup ? 'Handover item to borrower' : 'Return item to lender'}
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

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 text-center overflow-y-auto flex-1 safe-area-pb">
          {/* Target Student Instructions */}
          <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 text-left flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 font-mono block">
                Authorized {partnerRole}
              </span>
              <h4 className="text-xs font-bold text-stone-900">
                {partnerStudent.full_name || partnerStudent.username}
              </h4>
              <p className="text-[11px] text-stone-500">{partnerStudent.college_name}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-stone-400 font-mono block">Listing</span>
              <span className="text-xs font-bold text-stone-800 truncate block max-w-[120px]">
                {booking.listing.title}
              </span>
            </div>
          </div>

          {/* Success State */}
          {isSuccess ? (
            <div className="py-8 space-y-3 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-9 h-9 text-emerald-700" />
              </div>
              <h4 className="text-base font-bold text-stone-900">
                {isPickup ? 'Item Pickup Confirmed!' : 'Item Return Confirmed!'}
              </h4>
              <p className="text-xs text-stone-600 max-w-xs mx-auto leading-relaxed">
                {isPickup
                  ? 'The borrower has successfully scanned and verified the handover. The booking is now active.'
                  : 'The item return has been confirmed. The rental is marked returned.'}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-sm transition-all cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : isLoading ? (
            <div className="py-16 space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-800 animate-spin mx-auto" />
              <p className="text-xs text-stone-500 font-medium">Generating cryptographically secure token...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-3">
              <div className="flex items-center space-x-2 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Unable to generate QR code</span>
              </div>
              <p className="text-[11px] leading-relaxed text-rose-700">{error}</p>
              <button
                type="button"
                onClick={loadQR}
                className="px-4 py-1.5 rounded-full text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : qrDataUrl ? (
            <div className="space-y-4">
              {/* QR Image Box with Frame */}
              <div className="relative mx-auto w-64 h-64 p-3 bg-white rounded-3xl border-2 border-emerald-900/20 shadow-md flex items-center justify-center">
                <img
                  src={qrDataUrl}
                  alt="Item Handover QR Code"
                  className="w-full h-full object-contain rounded-2xl"
                />

                {/* Expiry Overlay if Expired */}
                {secondsRemaining <= 0 && (
                  <div className="absolute inset-0 bg-white/90 backdrop-blur-2xs rounded-3xl flex flex-col items-center justify-center p-4 space-y-2">
                    <AlertCircle className="w-8 h-8 text-amber-600" />
                    <p className="text-xs font-bold text-stone-800">QR Code Expired</p>
                    <button
                      type="button"
                      onClick={loadQR}
                      className="px-4 py-1.5 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-xs flex items-center space-x-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Generate Fresh QR</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Timer & Instructions */}
              <div className="flex items-center justify-center space-x-2 text-xs font-semibold text-stone-600">
                <Clock className="w-3.5 h-3.5 text-emerald-800" />
                <span>
                  Valid for: <strong className="text-[#1B3B2B] font-mono">{formatTimer(secondsRemaining)}</strong>
                </span>
                <button
                  type="button"
                  onClick={loadQR}
                  title="Refresh QR token"
                  className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Manual Backup Code Card */}
              {qrData?.verification_code && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 font-mono block">
                    Camera Broken or Unavailable?
                  </span>
                  <div className="flex items-center justify-center space-x-2">
                    <span className="text-base font-mono font-extrabold text-[#1B3B2B] tracking-widest bg-white px-3 py-1 rounded-xl border border-emerald-300">
                      {qrData.verification_code}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="p-2 rounded-xl bg-white hover:bg-emerald-100/60 border border-emerald-300 text-emerald-900 transition-colors cursor-pointer"
                      title="Copy code"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-emerald-800 leading-tight">
                    The {partnerRole.toLowerCase()} can type this 6-character backup code into their scanner screen.
                  </p>
                </div>
              )}

              {/* Security Snapshot Note */}
              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70 text-[10px] text-stone-500 flex items-center justify-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>Single-use cryptographic token bound to this booking</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
