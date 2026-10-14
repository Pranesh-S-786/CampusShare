import { useState, useEffect, useCallback } from 'react'
import {
  X,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RotateCcw,
  Loader2,
  ArrowRight,
  Camera,
  QrCode,
  Sparkles,
  CreditCard,
  FileCheck2,
} from 'lucide-react'
import {
  type Booking,
  getMyBookings,
  cancelBooking,
  resolveMediaUrl,
} from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { HandoverQRModal } from './HandoverQRModal'
import { HandoverScanModal } from './HandoverScanModal'
import { BookingFinancialModal } from './BookingFinancialModal'
import { TermsAgreementModal } from './TermsAgreementModal'
import { AdvancePaymentModal } from './AdvancePaymentModal'

interface MyBookingsModalProps {
  isOpen: boolean
  onClose: () => void
  onOpenIncomingRequests?: () => void
}

export function MyBookingsModal({
  isOpen,
  onClose,
  onOpenIncomingRequests,
}: MyBookingsModalProps) {
  const { user } = useAuth()
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'accepted' | 'active' | 'returned' | 'completed' | 'declined' | 'cancelled'>('all')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cancel action state
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const [cancelNote, setCancelNote] = useState('')
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false)

  // Handover QR / Scan Modal state
  const [scanModalBooking, setScanModalBooking] = useState<Booking | null>(null)
  const [scanActionType, setScanActionType] = useState<'pickup' | 'return'>('pickup')
  const [isScanModalOpen, setIsScanModalOpen] = useState(false)

  const [qrModalBooking, setQrModalBooking] = useState<Booking | null>(null)
  const [qrActionType, setQrActionType] = useState<'pickup' | 'return'>('return')
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)

  // Stage 8 Financial Management Modal state
  const [financialModalBookingId, setFinancialModalBookingId] = useState<number | null>(null)
  const [isFinancialModalOpen, setIsFinancialModalOpen] = useState(false)

  // Enhancement 1: Terms Agreement Modal
  const [termsModalBooking, setTermsModalBooking] = useState<Booking | null>(null)
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false)

  // Enhancement 2: Advance Payment Confirmation Modal
  const [advanceModalBooking, setAdvanceModalBooking] = useState<Booking | null>(null)
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false)

  const loadBookings = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    setError(null)
    try {
      const filterParam = activeFilter === 'all' ? undefined : activeFilter
      const res = await getMyBookings(filterParam)
      setBookings(res.bookings)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings.')
      setBookings([])
    } finally {
      setIsLoading(false)
    }
  }, [user, activeFilter])

  useEffect(() => {
    if (isOpen) {
      loadBookings()
    }
  }, [isOpen, loadBookings])

  if (!isOpen) return null

  const handleCancelSubmit = async (bookingId: number) => {
    setIsSubmittingCancel(true)
    try {
      await cancelBooking(bookingId, cancelNote)
      setCancellingId(null)
      setCancelNote('')
      loadBookings()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to cancel booking.')
    } finally {
      setIsSubmittingCancel(false)
    }
  }

  const handleOpenScan = (b: Booking, action: 'pickup' | 'return') => {
    setScanModalBooking(b)
    setScanActionType(action)
    setIsScanModalOpen(true)
  }

  const handleOpenPresentQR = (b: Booking, action: 'pickup' | 'return') => {
    setQrModalBooking(b)
    setQrActionType(action)
    setIsQrModalOpen(true)
  }

  const getStatusBadge = (status: Booking['status']) => {
    switch (status) {
      case 'accepted':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-700" />
            Accepted / Ready for Pickup
          </span>
        )
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
            <Sparkles className="w-3.5 h-3.5 mr-1 text-indigo-700" />
            Active Rental (In Hand)
          </span>
        )
      case 'returned':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-900 border border-teal-200">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-teal-700" />
            Returned to Owner
          </span>
        )
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
            <Clock className="w-3.5 h-3.5 mr-1 text-amber-700" />
            Pending Owner Approval
          </span>
        )
      case 'declined':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-900 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 mr-1 text-rose-700" />
            Declined
          </span>
        )
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-stone-100 text-stone-700 border border-stone-200">
            Cancelled
          </span>
        )
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-200">
            Completed
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-t-3xl sm:rounded-3xl bg-white border border-stone-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 max-h-[94vh] sm:max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-100 bg-[#FBF8F3]">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-900 flex items-center justify-center font-bold shrink-0">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-800" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-stone-900 truncate">My Booking Requests</h3>
              <p className="text-[11px] sm:text-xs text-stone-500 truncate">Items you requested to borrow, rent, or buy</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {onOpenIncomingRequests && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenIncomingRequests()
                }}
                className="hidden xs:flex px-3 py-1.5 rounded-full text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors items-center space-x-1 cursor-pointer"
              >
                <span>Incoming</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-3 sm:px-6 py-2.5 sm:py-3 border-b border-stone-100 bg-white flex items-center justify-between overflow-x-auto scrollbar-none touch-pan-x touch-scroll">
          <div className="flex items-center space-x-1.5">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'pending', label: 'Pending' },
                { id: 'accepted', label: 'Ready for Pickup' },
                { id: 'active', label: 'Active Rentals' },
                { id: 'returned', label: 'Returned' },
                { id: 'completed', label: 'Completed' },
                { id: 'declined', label: 'Declined' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  activeFilter === tab.id
                    ? 'bg-[#1B3B2B] text-white shadow-xs'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={loadBookings}
            disabled={isLoading}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            title="Refresh"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-800' : ''}`} />
          </button>
        </div>

        {/* List of Bookings */}
        <div className="overflow-y-auto p-6 space-y-4 flex-1">
          {isLoading && bookings.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-7 h-7 text-emerald-800 animate-spin mx-auto" />
              <p className="text-xs text-stone-500 font-medium">Loading your bookings...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : bookings.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
                <Calendar className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-stone-700">No bookings in this category</h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Browse campus listings on the marketplace and submit a request to borrow or buy gear.
              </p>
            </div>
          ) : (
            bookings.map((b) => {
              const isCancelling = cancellingId === b.id
              const canCancel = b.status === 'pending' || b.status === 'accepted'

              // Timeline calculation for this card
              const timelineSteps = [
                { name: '1. Requested', done: true, time: new Date(b.created_at).toLocaleDateString() },
                { name: '2. Accepted', done: b.status !== 'pending' && b.status !== 'declined' && b.status !== 'cancelled' },
                {
                  name: '3. Picked Up',
                  done: b.status === 'active' || b.status === 'returned' || b.status === 'completed',
                  time: b.pickup_confirmed_at ? new Date(b.pickup_confirmed_at).toLocaleDateString() : undefined,
                },
                {
                  name: '4. Returned',
                  done: b.status === 'returned' || b.status === 'completed',
                  time: b.return_confirmed_at ? new Date(b.return_confirmed_at).toLocaleDateString() : undefined,
                },
                { name: '5. Completed', done: b.status === 'completed' },
              ]

              return (
                <div
                  key={b.id}
                  className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200/90 shadow-2xs hover:shadow-xs transition-all space-y-4"
                >
                  {/* Top Bar: Listing & Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-14 h-14 rounded-xl bg-stone-100 overflow-hidden shrink-0 border border-stone-200">
                        {b.listing?.image_url ? (
                          <img
                            src={resolveMediaUrl(b.listing.image_url)}
                            alt={b.listing.title}
                            onError={(e) => {
                              e.currentTarget.onerror = null
                              e.currentTarget.style.display = 'none'
                            }}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-stone-400 font-mono">
                            Item
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-wider text-emerald-800 font-mono">
                          <span>{b.listing?.category_name}</span>
                          <span>•</span>
                          <span className="capitalize">{b.snapshot_listing_type}</span>
                        </div>
                        <h4 className="text-sm font-bold text-stone-900 truncate">
                          {b.listing?.title || 'Campus Item'}
                        </h4>
                        <p className="text-xs text-stone-500">
                          Owner: <strong className="text-stone-700">{b.lender.full_name || b.lender.username}</strong> ({b.lender.college_name})
                        </p>
                      </div>
                    </div>

                    <div className="self-start sm:self-auto shrink-0">
                      {getStatusBadge(b.status)}
                    </div>
                  </div>

                  {/* Step-by-Step Handover Timeline */}
                  {b.status !== 'declined' && b.status !== 'cancelled' && (
                    <div className="p-2.5 rounded-xl bg-stone-50/80 border border-stone-100">
                      <div className="flex items-center justify-between text-[10px] font-mono font-bold tracking-wider">
                        {timelineSteps.map((step, idx) => (
                          <div key={idx} className="flex items-center space-x-1">
                            <span
                              className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${
                                step.done ? 'bg-[#1B3B2B] text-white' : 'bg-stone-200 text-stone-500'
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <span className={step.done ? 'text-stone-800' : 'text-stone-400'}>
                              {step.name.split('. ')[1]}
                            </span>
                            {idx < timelineSteps.length - 1 && (
                              <span className="text-stone-300 mx-1">›</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Booking Details Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-stone-50 border border-stone-100 text-xs">
                    <div>
                      <span className="text-[10px] text-stone-500 uppercase tracking-wider font-mono block">
                        Dates
                      </span>
                      <span className="font-semibold text-stone-800">
                        {b.start_date} → {b.end_date}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-stone-500 uppercase tracking-wider font-mono block">
                        Duration
                      </span>
                      <span className="font-semibold text-stone-800">
                        {b.duration_days} day{b.duration_days === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-stone-500 uppercase tracking-wider font-mono block">
                        Calculated Rent
                      </span>
                      <span className="font-semibold text-stone-800">
                        ₹{b.calculated_total_rent}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-stone-500 uppercase tracking-wider font-mono block">
                        Total Due Upfront
                      </span>
                      <span className="font-bold text-[#1B3B2B]">
                        ₹{b.total_due_upfront}
                      </span>
                    </div>
                  </div>

                  {/* Messages / Notes */}
                  {b.borrower_message && (
                    <div className="p-3 rounded-xl bg-stone-50/70 border border-stone-200/60 text-xs">
                      <span className="font-bold text-stone-700 block mb-0.5">Your Message:</span>
                      <p className="text-stone-600 whitespace-pre-line">{b.borrower_message}</p>
                    </div>
                  )}

                  {b.owner_response_note && (
                    <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/70 text-xs text-emerald-950">
                      <span className="font-bold text-emerald-900 block mb-0.5">Owner's Note:</span>
                      <p className="text-emerald-900/90 whitespace-pre-line">{b.owner_response_note}</p>
                    </div>
                  )}

                  {/* Stage 7 QR Handover Action Banners & Lifecycle Statuses */}
                  {b.status === 'accepted' && (
                    b.snapshot_listing_type !== 'sell' && b.terms_status !== 'agreed' ? (
                      <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-xs font-bold text-amber-950 block">
                            Rental Terms Agreement Pending
                          </span>
                          <p className="text-[11px] text-amber-800">
                            {b.terms_status === 'adjustment_proposed'
                              ? 'Owner proposed revised terms. Please review and accept before pickup.'
                              : b.terms_status === 'rejected'
                              ? 'You requested changes to the proposed terms. Awaiting owner update.'
                              : 'Review and confirm the rental terms before pickup.'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setTermsModalBooking(b)
                            setIsTermsModalOpen(true)
                          }}
                          className="px-5 py-2 rounded-full text-xs font-bold text-white bg-amber-800 hover:bg-amber-900 shadow-sm transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
                        >
                          <FileCheck2 className="w-4 h-4" />
                          <span>Review Terms</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-xs font-bold text-emerald-950 block">
                            Terms Agreed • Ready for Campus Collection
                          </span>
                          <p className="text-[11px] text-emerald-800">
                            Meet {b.lender.full_name || b.lender.username} on campus and scan their pickup QR code.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenScan(b, 'pickup')}
                          className="px-5 py-2 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-sm transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Scan Pickup QR</span>
                        </button>
                      </div>
                    )
                  )}

                  {b.status === 'active' && b.snapshot_listing_type !== 'sell' && (
                    <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-indigo-950 block">
                          Rental In Progress
                        </span>
                        <p className="text-[11px] text-indigo-800">
                          When returning item to owner, generate and present your return QR code.
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            setAdvanceModalBooking(b)
                            setIsAdvanceModalOpen(true)
                          }}
                          className="px-3.5 py-2 rounded-full text-xs font-bold text-indigo-900 bg-white hover:bg-indigo-50 border border-indigo-200 shadow-2xs transition-all flex items-center space-x-1 shrink-0 cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Advance Status</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenPresentQR(b, 'return')}
                          className="px-5 py-2 rounded-full text-xs font-bold text-white bg-indigo-800 hover:bg-indigo-900 shadow-sm transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
                        >
                          <QrCode className="w-4 h-4" />
                          <span>Show Return QR</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {b.status === 'returned' && (
                    <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-teal-950 block">
                          Item Returned to Owner
                        </span>
                        <p className="text-[11px] text-teal-800">
                          Your physical return has been recorded. Review and settle the final bill.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFinancialModalBookingId(b.id)
                          setIsFinancialModalOpen(true)
                        }}
                        className="px-4 py-2 rounded-full text-xs font-bold text-teal-900 bg-white hover:bg-teal-50 border border-teal-200 shadow-2xs transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>View Final Bill</span>
                      </button>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs">
                    <span className="text-[11px] text-stone-400">
                      Requested {new Date(b.created_at).toLocaleDateString()}
                    </span>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFinancialModalBookingId(b.id)
                          setIsFinancialModalOpen(true)
                        }}
                        className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 transition-colors cursor-pointer flex items-center space-x-1.5"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-emerald-800" />
                        <span>Billing & Payments</span>
                      </button>

                      {canCancel && !isCancelling && (
                        <button
                          type="button"
                          onClick={() => setCancellingId(b.id)}
                          className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
                        >
                          Cancel Request
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Cancel Confirmation Prompt */}
                  {isCancelling && (
                    <div className="p-3.5 rounded-xl bg-rose-50/80 border border-rose-200 space-y-2 animate-in fade-in">
                      <p className="text-xs font-bold text-rose-900">
                        Are you sure you want to cancel this booking request?
                      </p>
                      <input
                        type="text"
                        placeholder="Reason (optional)"
                        value={cancelNote}
                        onChange={(e) => setCancelNote(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-rose-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-rose-400"
                      />
                      <div className="flex items-center justify-end space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setCancellingId(null)
                            setCancelNote('')
                          }}
                          disabled={isSubmittingCancel}
                          className="px-3 py-1 rounded-lg text-xs font-medium text-stone-600 hover:bg-white cursor-pointer"
                        >
                          Keep Booking
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancelSubmit(b.id)}
                          disabled={isSubmittingCancel}
                          className="px-4 py-1 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 cursor-pointer flex items-center space-x-1"
                        >
                          {isSubmittingCancel ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Cancelling...</span>
                            </>
                          ) : (
                            <span>Confirm Cancellation</span>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* QR Modals */}
      <HandoverQRModal
        booking={qrModalBooking}
        actionType={qrActionType}
        isOpen={isQrModalOpen}
        onClose={() => {
          setIsQrModalOpen(false)
          setQrModalBooking(null)
        }}
        onHandoverCompleted={(updated) => {
          loadBookings()
          if (qrActionType === 'return' && updated) {
            setFinancialModalBookingId(updated.id)
            setIsFinancialModalOpen(true)
          }
        }}
      />

      <HandoverScanModal
        booking={scanModalBooking}
        actionType={scanActionType}
        isOpen={isScanModalOpen}
        onClose={() => {
          setIsScanModalOpen(false)
          setScanModalBooking(null)
        }}
        onSuccess={(updated) => {
          loadBookings()
          if (scanActionType === 'pickup' && updated && updated.snapshot_listing_type !== 'sell') {
            setAdvanceModalBooking(updated)
            setIsAdvanceModalOpen(true)
          }
        }}
      />

      {financialModalBookingId && (
        <BookingFinancialModal
          bookingId={financialModalBookingId}
          isOpen={isFinancialModalOpen}
          onClose={() => {
            setIsFinancialModalOpen(false)
            setFinancialModalBookingId(null)
          }}
          onUpdated={() => {
            loadBookings()
          }}
        />
      )}

      {/* Enhancement 1: Terms Agreement Review Modal */}
      {termsModalBooking && (
        <TermsAgreementModal
          booking={termsModalBooking}
          isLender={false}
          isOpen={isTermsModalOpen}
          onClose={() => {
            setIsTermsModalOpen(false)
            setTermsModalBooking(null)
          }}
          onTermsUpdated={() => {
            loadBookings()
          }}
        />
      )}

      {/* Enhancement 2: Advance Payment Confirmation Modal */}
      {advanceModalBooking && (
        <AdvancePaymentModal
          booking={advanceModalBooking}
          isLender={false}
          isOpen={isAdvanceModalOpen}
          onClose={() => {
            setIsAdvanceModalOpen(false)
            setAdvanceModalBooking(null)
          }}
          onSuccess={() => {
            loadBookings()
          }}
        />
      )}
    </div>
  )
}
