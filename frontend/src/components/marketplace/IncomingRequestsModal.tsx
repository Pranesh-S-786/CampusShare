import { useState, useEffect, useCallback } from 'react'
import {
  X,
  Inbox,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ShieldCheck,
  RotateCcw,
  Loader2,
  Check,
  Ban,
  ArrowRight,
  QrCode,
  Camera,
  Sparkles,
  CreditCard,
  FileCheck2,
} from 'lucide-react'
import {
  type Booking,
  getIncomingBookings,
  actionBooking,
} from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { HandoverQRModal } from './HandoverQRModal'
import { HandoverScanModal } from './HandoverScanModal'
import { BookingFinancialModal } from './BookingFinancialModal'
import { TermsAgreementModal } from './TermsAgreementModal'
import { AdvancePaymentModal } from './AdvancePaymentModal'
import { RelistChoiceModal } from './RelistChoiceModal'

interface IncomingRequestsModalProps {
  isOpen: boolean
  onClose: () => void
  onOpenMyBookings?: () => void
}

export function IncomingRequestsModal({
  isOpen,
  onClose,
  onOpenMyBookings,
}: IncomingRequestsModalProps) {
  const { user } = useAuth()
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'accepted' | 'active' | 'returned' | 'completed' | 'declined'>('all')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Action form state
  const [activeActionId, setActiveActionId] = useState<number | null>(null)
  const [actionType, setActionType] = useState<'accept' | 'decline' | 'complete' | null>(null)
  const [actionNote, setActionNote] = useState('')
  const [adjustedStartDate, setAdjustedStartDate] = useState('')
  const [adjustedEndDate, setAdjustedEndDate] = useState('')
  const [isSubmittingAction, setIsSubmittingAction] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Handover QR / Scan state
  const [qrModalBooking, setQrModalBooking] = useState<Booking | null>(null)
  const [qrActionType, setQrActionType] = useState<'pickup' | 'return'>('pickup')
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)

  const [scanModalBooking, setScanModalBooking] = useState<Booking | null>(null)
  const [scanActionType, setScanActionType] = useState<'pickup' | 'return'>('return')
  const [isScanModalOpen, setIsScanModalOpen] = useState(false)

  // Stage 8 Financial Management Modal state
  const [financialModalBookingId, setFinancialModalBookingId] = useState<number | null>(null)
  const [isFinancialModalOpen, setIsFinancialModalOpen] = useState(false)

  // Enhancement 1: Terms Agreement Modal
  const [termsModalBooking, setTermsModalBooking] = useState<Booking | null>(null)
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false)

  // Enhancement 2: Advance Payment Confirmation Modal
  const [advanceModalBooking, setAdvanceModalBooking] = useState<Booking | null>(null)
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false)

  // Enhancement 5: Re-listing Modal
  const [relistBooking, setRelistBooking] = useState<Booking | null>(null)
  const [isRelistOpen, setIsRelistOpen] = useState(false)

  const loadIncoming = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    setError(null)
    try {
      const filterParam = activeFilter === 'all' ? undefined : activeFilter
      const res = await getIncomingBookings(filterParam)
      setBookings(res.bookings)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load incoming requests.')
      setBookings([])
    } finally {
      setIsLoading(false)
    }
  }, [user, activeFilter])

  useEffect(() => {
    if (isOpen) {
      loadIncoming()
    }
  }, [isOpen, loadIncoming])

  if (!isOpen) return null

  const handleOpenAction = (booking: Booking, type: 'accept' | 'decline' | 'complete') => {
    setActiveActionId(booking.id)
    setActionType(type)
    setActionNote('')
    setAdjustedStartDate(booking.start_date)
    setAdjustedEndDate(booking.end_date)
    setActionError(null)
  }

  const handleCancelAction = () => {
    setActiveActionId(null)
    setActionType(null)
    setActionNote('')
    setActionError(null)
  }

  const handleSubmitAction = async (bookingId: number) => {
    if (!actionType) return
    setIsSubmittingAction(true)
    setActionError(null)

    try {
      const res = await actionBooking(bookingId, {
        action: actionType,
        note: actionNote.trim() || undefined,
        start_date: actionType === 'accept' && adjustedStartDate ? adjustedStartDate : undefined,
        end_date: actionType === 'accept' && adjustedEndDate ? adjustedEndDate : undefined,
      })
      handleCancelAction()
      loadIncoming()

      // Enhancement 1: Mutual terms review popup on acceptance
      if (actionType === 'accept' && res.booking && res.booking.snapshot_listing_type !== 'sell') {
        setTermsModalBooking(res.booking)
        setIsTermsModalOpen(true)
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to perform action.')
    } finally {
      setIsSubmittingAction(false)
    }
  }

  const handleOpenPresentQR = (b: Booking, action: 'pickup' | 'return') => {
    setQrModalBooking(b)
    setQrActionType(action)
    setIsQrModalOpen(true)
  }

  const handleOpenScan = (b: Booking, action: 'pickup' | 'return') => {
    setScanModalBooking(b)
    setScanActionType(action)
    setIsScanModalOpen(true)
  }

  const getStatusBadge = (status: Booking['status']) => {
    switch (status) {
      case 'accepted':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-700" />
            Accepted / Awaiting Pickup
          </span>
        )
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
            <Sparkles className="w-3.5 h-3.5 mr-1 text-indigo-700" />
            Active Rental (With Borrower)
          </span>
        )
      case 'returned':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-900 border border-teal-200">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-teal-700" />
            Returned (Awaiting Completion)
          </span>
        )
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
            <Clock className="w-3.5 h-3.5 mr-1 text-amber-700" />
            Needs Your Review
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
            Cancelled by Borrower
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
              <Inbox className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-800" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-stone-900 truncate">Incoming Requests</h3>
              <p className="text-[11px] sm:text-xs text-stone-500 truncate">Review requests from verified students</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {onOpenMyBookings && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenMyBookings()
                }}
                className="hidden xs:flex px-3 py-1.5 rounded-full text-xs font-bold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 transition-colors items-center space-x-1 cursor-pointer"
              >
                <span>My Bookings</span>
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
                { id: 'pending', label: 'Pending Review' },
                { id: 'accepted', label: 'Accepted' },
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
            onClick={loadIncoming}
            disabled={isLoading}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            title="Refresh"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-800' : ''}`} />
          </button>
        </div>

        {/* Content List */}
        <div className="overflow-y-auto p-6 space-y-4 flex-1">
          {isLoading && bookings.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-7 h-7 text-emerald-800 animate-spin mx-auto" />
              <p className="text-xs text-stone-500 font-medium">Checking incoming requests...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : bookings.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
                <Inbox className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-stone-700">No incoming requests in this category</h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                When students on your campus request your gear, they will appear here for your review and approval.
              </p>
            </div>
          ) : (
            bookings.map((b) => {
              const isActionOpen = activeActionId === b.id

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
                            src={b.listing.image_url}
                            alt={b.listing.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-stone-400 font-mono">
                            Item
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 font-mono">
                          Your Listing:
                        </span>
                        <h4 className="text-sm font-bold text-stone-900 truncate">
                          {b.listing?.title || 'Campus Item'}
                        </h4>
                        <p className="text-xs text-stone-500">
                          {b.snapshot_listing_type === 'sell' ? 'Purchase Request' : `Rental (₹${b.snapshot_unit_price}/${b.snapshot_pricing_unit})`}
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

                  {/* Requester Profile Card */}
                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 flex items-center justify-between">
                    <div className="flex items-center space-x-3 min-w-0">
                      {b.borrower.avatar_url ? (
                        <img
                          src={b.borrower.avatar_url}
                          alt={b.borrower.full_name}
                          className="w-10 h-10 rounded-full object-cover border border-emerald-600/30 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#1B3B2B] text-amber-100 flex items-center justify-center font-bold text-xs shrink-0">
                          {(b.borrower.full_name || b.borrower.username).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          <span className="text-xs font-bold text-stone-900 truncate">
                            {b.borrower.full_name || b.borrower.username}
                          </span>
                          {b.borrower.is_verified || b.borrower.is_college_verified ? (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <ShieldCheck className="w-3 h-3 mr-0.5 text-emerald-700" />
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              Unverified
                            </span>
                          )}
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-200">
                            🛡️ {b.borrower.trust_score ?? 75} Trust
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 truncate mt-0.5">
                          {b.borrower.college_name}
                          {b.borrower.major ? ` • ${b.borrower.major}` : ''}
                          {b.borrower.grad_year ? ` • Class of ${b.borrower.grad_year}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="text-[10px] text-stone-400 font-mono shrink-0">
                      Requester
                    </div>
                  </div>

                  {/* Booking Terms Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-emerald-50/40 border border-emerald-100 text-xs">
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
                        Total Rent
                      </span>
                      <span className="font-semibold text-stone-800">
                        ₹{b.calculated_total_rent}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-stone-500 uppercase tracking-wider font-mono block">
                        Upfront Due
                      </span>
                      <span className="font-bold text-[#1B3B2B]">
                        ₹{b.total_due_upfront}
                      </span>
                    </div>
                  </div>

                  {/* Requester Message */}
                  {b.borrower_message && (
                    <div className="p-3 rounded-xl bg-stone-50/80 border border-stone-200/70 text-xs">
                      <span className="font-bold text-stone-700 block mb-0.5">Requester's Note:</span>
                      <p className="text-stone-600 whitespace-pre-line">{b.borrower_message}</p>
                    </div>
                  )}

                  {/* Owner Response Note if already acted */}
                  {b.owner_response_note && (
                    <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/70 text-xs text-emerald-950">
                      <span className="font-bold text-emerald-900 block mb-0.5">Your Response Note:</span>
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
                              ? "You proposed revised terms. Awaiting borrower's confirmation."
                              : b.terms_status === 'rejected'
                              ? 'Borrower requested changes to proposed terms.'
                              : 'Review or adjust rental amounts before the first QR scan.'}
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
                          <span>Review / Adjust Terms</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-xs font-bold text-emerald-950 block">
                            Terms Agreed • Ready for Handover
                          </span>
                          <p className="text-[11px] text-emerald-800">
                            Present your pickup QR code to {b.borrower.full_name || b.borrower.username} when handing over the item.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenPresentQR(b, 'pickup')}
                          className="px-5 py-2 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-sm transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
                        >
                          <QrCode className="w-4 h-4" />
                          <span>Show Pickup QR</span>
                        </button>
                      </div>
                    )
                  )}

                  {b.status === 'active' && b.snapshot_listing_type !== 'sell' && (
                    <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-indigo-950 block">
                          Rental In Progress
                        </span>
                        <p className="text-[11px] text-indigo-800">
                          When borrower returns your item, scan their return QR code to confirm safe return.
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
                          onClick={() => handleOpenScan(b, 'return')}
                          className="px-5 py-2 rounded-full text-xs font-bold text-white bg-indigo-800 hover:bg-indigo-900 shadow-sm transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Scan Return QR</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {b.status === 'returned' && (
                    <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-teal-950 block">
                          Item Returned Successfully
                        </span>
                        <p className="text-[11px] text-teal-800">
                          Borrower has returned the gear. Complete the settlement and verify all payment obligations.
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            setFinancialModalBookingId(b.id)
                            setIsFinancialModalOpen(true)
                          }}
                          className="px-4 py-2 rounded-full text-xs font-bold text-teal-900 bg-white hover:bg-teal-50 border border-teal-200 shadow-2xs transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Final Settlement Bill</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenAction(b, 'complete')}
                          className="px-5 py-2 rounded-full text-xs font-bold text-white bg-teal-800 hover:bg-teal-900 shadow-sm transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>Mark Completed</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {b.status === 'completed' && b.relist_prompted && (
                    <div className="p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-emerald-950 block">
                          Order Closed — Re-list Product?
                        </span>
                        <p className="text-[11px] text-emerald-800">
                          Would you like to list this product in the marketplace again?
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setRelistBooking(b)
                          setIsRelistOpen(true)
                        }}
                        className="px-5 py-2 rounded-full text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 shadow-sm transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Re-list Options</span>
                      </button>
                    </div>
                  )}

                  {/* Actions & Billing Bar */}
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
                        className="px-3 py-1.5 rounded-full text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 transition-colors cursor-pointer flex items-center space-x-1.5"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-emerald-800" />
                        <span>Billing & Payments</span>
                      </button>

                      {b.status === 'pending' && !isActionOpen && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenAction(b, 'decline')}
                            className="px-3.5 py-1.5 rounded-full text-xs font-bold text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer flex items-center space-x-1"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Decline</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenAction(b, 'accept')}
                            className="px-4 py-1.5 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-sm transition-all cursor-pointer flex items-center space-x-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Accept</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action Form Dialog (Accept / Decline / Complete) */}
                  {isActionOpen && (
                    <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold text-stone-900 capitalize">
                          {actionType === 'accept'
                            ? 'Accept & Confirm Booking'
                            : actionType === 'decline'
                            ? 'Decline Booking Request'
                            : 'Mark Booking as Completed'}
                        </h5>
                        <button
                          type="button"
                          onClick={handleCancelAction}
                          className="text-stone-400 hover:text-stone-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* If accepting, optionally adjust dates */}
                      {actionType === 'accept' && b.snapshot_listing_type !== 'sell' && (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="block text-[10px] font-bold text-stone-500 uppercase font-mono mb-1">
                              Confirmed Start
                            </label>
                            <input
                              type="date"
                              value={adjustedStartDate}
                              onChange={(e) => setAdjustedStartDate(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-stone-500 uppercase font-mono mb-1">
                              Confirmed End
                            </label>
                            <input
                              type="date"
                              value={adjustedEndDate}
                              onChange={(e) => setAdjustedEndDate(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          {actionType === 'accept'
                            ? 'Pickup Instructions & Handover Note'
                            : actionType === 'complete'
                            ? 'Completion Note for Student (Optional)'
                            : 'Reason for Declining Request'}
                        </label>
                        <textarea
                          rows={2}
                          value={actionNote}
                          onChange={(e) => setActionNote(e.target.value)}
                          placeholder={
                            actionType === 'accept'
                              ? 'e.g. Confirmed! Meet me outside the library cafeteria at 2 PM.'
                              : actionType === 'complete'
                              ? 'e.g. Item returned safely in great condition. Thank you!'
                              : 'e.g. Sorry, I have an upcoming lab and need the item this week.'
                          }
                          className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-[#1B3B2B] resize-none"
                        />
                      </div>

                      {actionError && (
                        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{actionError}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-end space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={handleCancelAction}
                          disabled={isSubmittingAction}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-200/60 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSubmitAction(b.id)}
                          disabled={isSubmittingAction}
                          className={`px-5 py-1.5 rounded-lg text-xs font-bold text-white transition-all cursor-pointer flex items-center space-x-1.5 ${
                            actionType === 'accept'
                              ? 'bg-[#1B3B2B] hover:bg-[#25503B]'
                              : actionType === 'decline'
                              ? 'bg-rose-600 hover:bg-rose-700'
                              : 'bg-teal-700 hover:bg-teal-800'
                          }`}
                        >
                          {isSubmittingAction ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Processing...</span>
                            </>
                          ) : (
                            <span>
                              {actionType === 'accept'
                                ? 'Confirm Acceptance'
                                : actionType === 'decline'
                                ? 'Confirm Decline'
                                : 'Complete'}
                            </span>
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
          loadIncoming()
          if (qrActionType === 'pickup' && updated && updated.snapshot_listing_type !== 'sell') {
            setAdvanceModalBooking(updated)
            setIsAdvanceModalOpen(true)
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
          loadIncoming()
          if (scanActionType === 'return' && updated) {
            setFinancialModalBookingId(updated.id)
            setIsFinancialModalOpen(true)
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
            loadIncoming()
          }}
        />
      )}

      {/* Enhancement 1: Terms Agreement Review Modal */}
      {termsModalBooking && (
        <TermsAgreementModal
          booking={termsModalBooking}
          isLender={true}
          isOpen={isTermsModalOpen}
          onClose={() => {
            setIsTermsModalOpen(false)
            setTermsModalBooking(null)
          }}
          onTermsUpdated={() => {
            loadIncoming()
          }}
        />
      )}

      {/* Enhancement 2: Advance Payment Confirmation Modal */}
      {advanceModalBooking && (
        <AdvancePaymentModal
          booking={advanceModalBooking}
          isLender={true}
          isOpen={isAdvanceModalOpen}
          onClose={() => {
            setIsAdvanceModalOpen(false)
            setAdvanceModalBooking(null)
          }}
          onSuccess={() => {
            loadIncoming()
          }}
        />
      )}

      {/* Enhancement 5: Re-listing Choice Modal */}
      {relistBooking && (
        <RelistChoiceModal
          booking={relistBooking}
          isOpen={isRelistOpen}
          onClose={() => {
            setIsRelistOpen(false)
            setRelistBooking(null)
          }}
          onRelisted={() => {
            loadIncoming()
          }}
        />
      )}
    </div>
  )
}
