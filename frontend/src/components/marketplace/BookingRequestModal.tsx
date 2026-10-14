import { useState, useEffect } from 'react'
import {
  X,
  Calendar,
  AlertCircle,
  ShieldCheck,
  Send,
  Loader2,
  DollarSign,
  MapPin,
} from 'lucide-react'
import {
  type MarketplaceListing,
  type BookingQuote,
  type Booking,
  getBookingQuote,
  createBooking,
  resolveMediaUrl,
} from '../../services/api'
import { useAuth } from '../../context/AuthContext'

interface BookingRequestModalProps {
  listing: MarketplaceListing | null
  isOpen: boolean
  onClose: () => void
  onBookingSuccess: (booking: Booking) => void
}

export function BookingRequestModal({
  listing,
  isOpen,
  onClose,
  onBookingSuccess,
}: BookingRequestModalProps) {
  const { user } = useAuth()

  // Format today + days as YYYY-MM-DD
  const formatIsoDate = (d: Date) => d.toISOString().split('T')[0]
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const defaultEnd = new Date(tomorrow)
  defaultEnd.setDate(defaultEnd.getDate() + 2)

  const [startDate, setStartDate] = useState(formatIsoDate(tomorrow))
  const [endDate, setEndDate] = useState(formatIsoDate(defaultEnd))
  const [borrowerMessage, setBorrowerMessage] = useState('')

  const [quote, setQuote] = useState<BookingQuote | null>(null)
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Reset dates when listing opens
  useEffect(() => {
    if (listing && isOpen) {
      const t1 = new Date()
      t1.setDate(t1.getDate() + 1)
      const t2 = new Date(t1)
      t2.setDate(t2.getDate() + (listing.listing_type === 'sell' ? 0 : 2))
      setStartDate(formatIsoDate(t1))
      setEndDate(formatIsoDate(t2))
      setBorrowerMessage('')
      setSubmitError(null)
      setQuoteError(null)
    }
  }, [listing, isOpen])

  // Fetch live quote when dates change
  useEffect(() => {
    if (!isOpen || !listing || !startDate || !endDate) return

    let isMounted = true
    setIsLoadingQuote(true)
    setQuoteError(null)

    getBookingQuote(listing.id, startDate, endDate)
      .then((data) => {
        if (isMounted) {
          setQuote(data)
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setQuote(null)
          setQuoteError(err instanceof Error ? err.message : 'Failed to calculate quote.')
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingQuote(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, listing, startDate, endDate])

  if (!isOpen || !listing) return null

  const isSell = listing.listing_type === 'sell'
  const isLend = listing.listing_type === 'lend'
  const isOwner = user && listing.lender && user.id === listing.lender.id

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    if (isOwner) {
      setSubmitError('You cannot request your own listing.')
      return
    }

    if (quote?.has_conflict) {
      setSubmitError('Selected dates conflict with an existing confirmed booking.')
      return
    }

    setIsSubmitting(true)
    try {
      const newBooking = await createBooking({
        listing_id: listing.id,
        start_date: startDate,
        end_date: isSell ? startDate : endDate,
        borrower_message: borrowerMessage.trim() || undefined,
      })
      onBookingSuccess(newBooking)
      onClose()
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to create booking request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const minDateStr = formatIsoDate(today)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-t-3xl sm:rounded-3xl bg-white border border-stone-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 max-h-[92vh] sm:max-h-[88vh] flex flex-col"
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
              <h3 className="text-sm sm:text-base font-bold text-stone-900 truncate">
                {isSell ? 'Purchase Intent Request' : 'Submit Booking Request'}
              </h3>
              <p className="text-[11px] sm:text-xs text-stone-500 truncate">
                {isSell ? 'Reserve to inspect & purchase on campus' : 'Request to borrow or rent from peer'}
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
        <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 flex-1 safe-area-pb">
          {/* Listing Summary Preview */}
          <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/90 flex items-center space-x-3.5">
            <div className="w-16 h-16 rounded-xl bg-stone-200 overflow-hidden shrink-0 border border-stone-200">
              {listing.image_url ? (
                <img
                  src={resolveMediaUrl(listing.image_url)}
                  alt={listing.title}
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.style.display = 'none'
                  }}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-stone-400 font-mono">
                  No Pic
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 font-mono">
                <span>{listing.category.name}</span>
                <span>•</span>
                <span className="capitalize">{listing.listing_type}</span>
              </div>
              <h4 className="text-sm font-bold text-stone-900 truncate">{listing.title}</h4>
              <p className="text-xs text-stone-500 truncate">
                Owner: {listing.lender.full_name || listing.lender.username} ({listing.lender.college_name})
              </p>
            </div>

            <div className="text-right shrink-0">
              {isLend ? (
                <span className="text-xs font-bold text-emerald-800 px-2 py-0.5 rounded-md bg-emerald-100">
                  Free Lend
                </span>
              ) : (
                <>
                  <div className="text-sm font-extrabold text-[#1B3B2B]">₹{listing.price}</div>
                  <div className="text-[10px] text-stone-500">per {listing.pricing_unit}</div>
                </>
              )}
            </div>
          </div>

          {/* Dates Selector */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider font-mono">
              {isSell ? 'Desired Handover Date' : 'Proposed Rental Period'}
            </h4>

            {isSell ? (
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Expected Meetup Date
                </label>
                <input
                  type="date"
                  min={minDateStr}
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setEndDate(e.target.value)
                  }}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1B3B2B]/20 focus:border-[#1B3B2B] bg-white"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    min={minDateStr}
                    value={startDate}
                    onChange={(e) => {
                      const newStart = e.target.value
                      setStartDate(newStart)
                      if (newStart > endDate) {
                        setEndDate(newStart)
                      }
                    }}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1B3B2B]/20 focus:border-[#1B3B2B] bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    min={startDate || minDateStr}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1B3B2B]/20 focus:border-[#1B3B2B] bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Pricing Quote & Terms Snapshot */}
          <div className="p-4 rounded-2xl bg-[#FBF8F3] border border-stone-200 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-stone-800">
              <span className="flex items-center space-x-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-800" />
                <span>Financial Terms Breakdown</span>
              </span>
              {isLoadingQuote && (
                <span className="flex items-center text-[10px] text-stone-400 space-x-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Calculating...</span>
                </span>
              )}
            </div>

            {quoteError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{quoteError}</span>
              </div>
            )}

            {quote && (
              <div className="space-y-2 text-xs">
                {!isSell && (
                  <div className="flex justify-between text-stone-600">
                    <span>Duration:</span>
                    <span className="font-semibold text-stone-800">
                      {quote.quote.duration_days} day{quote.quote.duration_days === 1 ? '' : 's'}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-stone-600">
                  <span>{isSell ? 'Sale Price:' : isLend ? 'Lending Rate:' : 'Estimated Rent:'}</span>
                  <span className="font-semibold text-stone-800">
                    ₹{quote.quote.total_rent}
                  </span>
                </div>

                {!isSell && Number(quote.quote.deposit_amount) > 0 && (
                  <div className="flex justify-between text-stone-600">
                    <span className="flex items-center space-x-1">
                      <span>Refundable Deposit:</span>
                      <span className="text-[10px] text-emerald-700">(Returned after handover)</span>
                    </span>
                    <span className="font-semibold text-stone-800">
                      ₹{quote.quote.deposit_amount}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-stone-200/80 flex justify-between items-baseline text-stone-900 font-bold">
                  <span className="text-xs uppercase tracking-wider text-[#1B3B2B] font-mono">
                    Total Due Upfront:
                  </span>
                  <span className="text-base font-extrabold text-[#1B3B2B]">
                    ₹{quote.quote.total_due_upfront}
                  </span>
                </div>
              </div>
            )}

            {/* Availability Conflict Alert */}
            {quote?.has_conflict && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start space-x-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Item Already Reserved</p>
                  <p className="text-[11px] text-amber-800">
                    Another student has already reserved this item during the selected dates. Please adjust your start or end date.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Pickup location notice */}
          {listing.pickup_location && (
            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/70 flex items-start space-x-2 text-xs text-emerald-950">
              <MapPin className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Campus Handover Location: </span>
                <span>{listing.pickup_location}</span>
              </div>
            </div>
          )}

          {/* Optional Message */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-stone-700">
              Message to Owner <span className="font-normal text-stone-400">(Optional)</span>
            </label>
            <textarea
              rows={3}
              value={borrowerMessage}
              onChange={(e) => setBorrowerMessage(e.target.value)}
              placeholder="e.g. Hi! I need this for our robotics lab assignment this weekend. Can meet near the library after 4 PM."
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#1B3B2B]/20 focus:border-[#1B3B2B] bg-white resize-none"
            />
          </div>

          {/* Snapshot Guarantee Note */}
          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/70 text-[11px] text-stone-600 flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <p>
              <strong>Agreed Terms Snapshot:</strong> Once submitted, the pricing and deposit terms are snapshot-locked. Later edits to the listing will not alter your agreed booking terms.
            </p>
          </div>

          {/* Submit Error */}
          {submitError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Footer Submit Button */}
          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-full text-xs font-semibold text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoadingQuote || Boolean(quote?.has_conflict)}
              className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all flex items-center space-x-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSell ? 'Send Purchase Request' : 'Send Booking Request'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
