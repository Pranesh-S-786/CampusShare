import { useState } from 'react'
import {
  X,
  FileCheck2,
  ShieldAlert,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  Edit3,
  HelpCircle,
} from 'lucide-react'
import {
  type Booking,
  proposeBookingTerms,
  respondBookingTerms,
} from '../../services/api'

interface TermsAgreementModalProps {
  booking: Booking | null
  isLender: boolean
  isOpen: boolean
  onClose: () => void
  onTermsUpdated: (updatedBooking: Booking) => void
}

export function TermsAgreementModal({
  booking,
  isLender,
  isOpen,
  onClose,
  onTermsUpdated,
}: TermsAgreementModalProps) {
  const [wantAdjustment, setWantAdjustment] = useState<boolean | null>(null)
  const [proposedRent, setProposedRent] = useState<string>(
    booking?.proposed_rent_rate ? String(booking.proposed_rent_rate) : booking?.snapshot_unit_price || '50'
  )
  const [proposedUnit, setProposedUnit] = useState<string>(
    booking?.proposed_pricing_unit || booking?.snapshot_pricing_unit || 'day'
  )
  const [proposedDeposit, setProposedDeposit] = useState<string>(
    booking?.proposed_deposit_amount !== undefined && booking?.proposed_deposit_amount !== null
      ? String(booking.proposed_deposit_amount)
      : booking?.snapshot_deposit_amount || '0'
  )
  const [notes, setNotes] = useState<string>(booking?.proposed_terms_note || '')
  const [borrowerRejectNote, setBorrowerRejectNote] = useState<string>('')
  const [showRejectInput, setShowRejectInput] = useState<boolean>(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  if (!isOpen || !booking) return null

  const isAgreed = booking.terms_status === 'agreed'
  const isRejected = booking.terms_status === 'rejected'
  const isAdjustmentProposed = booking.terms_status === 'adjustment_proposed'

  // Effective terms display
  const displayRent = isAdjustmentProposed && booking.proposed_rent_rate !== null
    ? booking.proposed_rent_rate
    : booking.snapshot_unit_price
  const displayUnit = isAdjustmentProposed && booking.proposed_pricing_unit
    ? booking.proposed_pricing_unit
    : booking.snapshot_pricing_unit
  const displayDeposit = isAdjustmentProposed && booking.proposed_deposit_amount !== null
    ? booking.proposed_deposit_amount
    : booking.snapshot_deposit_amount

  // Lender action: Submit terms (retaining or adjusted)
  const handleLenderSubmit = async (adjust: boolean) => {
    setIsSubmitting(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const payload = adjust
        ? {
            adjust: true,
            proposed_rent_rate: parseFloat(proposedRent) || 0,
            proposed_pricing_unit: proposedUnit,
            proposed_deposit_amount: parseFloat(proposedDeposit) || 0,
            note: notes.trim(),
          }
        : {
            adjust: false,
            note: notes.trim(),
          }

      const res = await proposeBookingTerms(booking.id, payload)
      setSuccessMsg(res.message)
      onTermsUpdated(res.booking)
      setTimeout(() => {
        onClose()
      }, 1200)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit terms proposal.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Borrower action: Accept or Reject terms
  const handleBorrowerRespond = async (action: 'accept' | 'reject') => {
    if (action === 'reject' && !showRejectInput) {
      setShowRejectInput(true)
      return
    }

    setIsSubmitting(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const res = await respondBookingTerms(booking.id, {
        action,
        note: borrowerRejectNote.trim(),
      })
      setSuccessMsg(res.message)
      onTermsUpdated(res.booking)
      setTimeout(() => {
        onClose()
      }, 1200)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to respond to rental terms.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#FBF8F3] border border-stone-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 max-h-[92vh] sm:max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-200/80 bg-white">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-[#1B3B2B] flex items-center justify-center border border-emerald-100 shrink-0">
              <FileCheck2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-800" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-stone-900 text-xs sm:text-base">
                Rental Agreement Review
              </h3>
              <p className="text-[11px] sm:text-xs text-stone-500 font-mono truncate max-w-[220px] sm:max-w-[260px]">
                {booking.listing.title} • CS-BKG-{booking.id}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-400 hover:text-stone-600 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs text-stone-700">
          {/* Policy Banner */}
          <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/60 text-amber-900 flex items-start space-x-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold">Mutual Agreement Required Before Handover:</span> Both borrower and lender must explicitly agree on rental amounts and deposit before the first QR pickup code can be generated. Agreed terms freeze as a tamper-proof booking snapshot.
            </div>
          </div>

          {/* Current Booking Summary Card */}
          <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-stone-900 pb-2 border-b border-stone-100">
              <span className="font-semibold text-xs text-stone-600">Product Name</span>
              <span className="font-bold text-xs truncate max-w-[240px]">{booking.listing.title}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-stone-700">
              <div>
                <span className="block text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Agreed Rate</span>
                <span className="font-bold text-xs text-stone-900">
                  ₹{displayRent} / {displayUnit}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Security Deposit</span>
                <span className="font-bold text-xs text-stone-900">
                  ₹{displayDeposit}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Pickup Date</span>
                <span className="font-medium text-xs text-stone-800 flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3 h-3 text-stone-400" />
                  {booking.start_date}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Return Date</span>
                <span className="font-medium text-xs text-stone-800 flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3 h-3 text-stone-400" />
                  {booking.end_date || 'Same Day'}
                </span>
              </div>
            </div>

            {booking.proposed_terms_note && (
              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-100 text-[11px] text-stone-600 mt-2">
                <span className="font-semibold text-stone-700">Lender's Note: </span>
                {booking.proposed_terms_note}
              </div>
            )}
          </div>

          {/* Status Badge */}
          {isAgreed && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Rental terms have been accepted by both parties! The item is ready for handover QR generation.</span>
            </div>
          )}

          {isRejected && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center space-x-2 font-medium">
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Borrower declined or requested changes to proposed terms. Awaiting revision.</span>
            </div>
          )}

          {/* ========================================================
              LENDER INTERFACE (Section 1)
             ======================================================== */}
          {isLender && !isAgreed && (
            <div className="space-y-4 pt-1">
              {wantAdjustment === null ? (
                <div className="p-4 rounded-2xl bg-white border border-stone-200 space-y-3">
                  <div className="flex items-center space-x-2 text-stone-900 font-bold text-xs">
                    <HelpCircle className="w-4 h-4 text-amber-600" />
                    <span>Do you want to adjust the rental amounts?</span>
                  </div>
                  <p className="text-[11px] text-stone-500 leading-relaxed">
                    You can adjust the rental rate, duration unit, or deposit amount before handover. If you select No, existing proposed booking terms will be retained.
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setWantAdjustment(true)}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-800 text-white font-bold text-xs hover:bg-emerald-900 transition-colors shadow-xs cursor-pointer"
                    >
                      Yes, Adjust Amounts
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setWantAdjustment(false)
                        handleLenderSubmit(false)
                      }}
                      disabled={isSubmitting}
                      className="flex-1 py-2.5 px-4 rounded-xl border border-stone-300 bg-white text-stone-700 font-semibold text-xs hover:bg-stone-50 transition-colors cursor-pointer"
                    >
                      {isSubmitting ? 'Confirming...' : 'No, Keep Existing'}
                    </button>
                  </div>
                </div>
              ) : wantAdjustment === true ? (
                <div className="p-4 rounded-2xl bg-white border border-stone-200 space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-stone-100">
                    <span className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-emerald-800" />
                      Revise Rental Terms
                    </span>
                    <button
                      type="button"
                      onClick={() => setWantAdjustment(null)}
                      className="text-[11px] text-stone-500 hover:text-stone-800 underline cursor-pointer"
                    >
                      Back
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                        Rent Amount (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={proposedRent}
                        onChange={(e) => setProposedRent(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs font-bold text-stone-900 outline-none focus:border-[#1B3B2B]"
                        placeholder="50"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                        Pricing Unit
                      </label>
                      <select
                        value={proposedUnit}
                        onChange={(e) => setProposedUnit(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs text-stone-900 outline-none focus:border-[#1B3B2B]"
                      >
                        <option value="hour">per hour</option>
                        <option value="day">per day</option>
                        <option value="week">per week</option>
                        <option value="month">per month</option>
                        <option value="semester">per semester</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                      Refundable Deposit (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={proposedDeposit}
                      onChange={(e) => setProposedDeposit(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs text-stone-900 outline-none focus:border-[#1B3B2B]"
                      placeholder="200"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                      Reason / Notes for Borrower
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs text-stone-900 outline-none focus:border-[#1B3B2B]"
                      placeholder="e.g. Added accessory, adjusted rate for weekend duration"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLenderSubmit(true)}
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-800 text-white font-bold text-xs hover:bg-emerald-900 transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending Proposal...</span>
                      </>
                    ) : (
                      <span>Propose Revised Terms to Borrower</span>
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* ========================================================
              BORROWER INTERFACE (Section 1)
             ======================================================== */}
          {!isLender && !isAgreed && (
            <div className="space-y-4 pt-1">
              {isAdjustmentProposed && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                  <span className="font-bold">Lender Proposes Revised Terms:</span>
                  <p className="mt-1 text-[11px]">
                    The lender proposed ₹{booking.proposed_rent_rate}/{booking.proposed_pricing_unit} and deposit of ₹{booking.proposed_deposit_amount}.
                  </p>
                </div>
              )}

              {showRejectInput ? (
                <div className="p-4 rounded-2xl bg-white border border-stone-200 space-y-3">
                  <label className="block text-xs font-semibold text-stone-700">
                    Reason for rejecting or requesting changes:
                  </label>
                  <textarea
                    rows={2}
                    value={borrowerRejectNote}
                    onChange={(e) => setBorrowerRejectNote(e.target.value)}
                    placeholder="e.g. The proposed deposit is higher than initially expected..."
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs text-stone-900 outline-none focus:border-[#1B3B2B]"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleBorrowerRespond('reject')}
                      disabled={isSubmitting}
                      className="flex-1 py-2 px-3 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? 'Sending...' : 'Confirm Reject / Change Request'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRejectInput(false)}
                      className="py-2 px-3 rounded-xl border border-stone-300 text-stone-600 text-xs hover:bg-stone-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleBorrowerRespond('accept')}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-800 text-white font-bold text-xs hover:bg-emerald-900 transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Accepting...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Accept Terms</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRejectInput(true)}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-stone-300 bg-white text-stone-700 font-semibold text-xs hover:bg-stone-50 transition-colors cursor-pointer"
                  >
                    Request Changes / Reject
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Feedback messages */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
              {successMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
