import { useState, useEffect, useCallback } from 'react'
import {
  X,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  FileText,
  PlusCircle,
  ShieldCheck,
  Loader2,
  Send,
  Check,
  ExternalLink,
  Clock,
  RotateCcw,
  Star,
  ShieldAlert,
  Scale,
} from 'lucide-react'
import {
  type BookingFinancialsResponse,
  type Booking,
  getBookingFinancials,
  declarePayment,
  confirmPayment,
  disputePayment,
  proposeAdjustment,
  respondAdjustment,
  declareDepositRefund,
  confirmDepositRefund,
  uploadPaymentEvidence,
  proposeAdvancePayment,
  respondAdvancePayment,
  proposeRentAdjustment,
  respondRentAdjustment,
  getLateFeeEstimate,
  agreeToSettlement,
  type LateFeeEstimate,
} from '../../services/api'
import { SettlementBillModal } from './SettlementBillModal'
import { RelistChoiceModal } from './RelistChoiceModal'
import { ReviewModal } from './ReviewModal'

interface BookingFinancialModalProps {
  bookingId: number
  booking?: Booking | null
  isOpen: boolean
  onClose: () => void
  onUpdated?: () => void
}

export function BookingFinancialModal({
  bookingId,
  booking: initialBooking,
  isOpen,
  onClose,
  onUpdated,
}: BookingFinancialModalProps) {
  const [data, setData] = useState<BookingFinancialsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Submodal: Printable Bill
  const [isBillOpen, setIsBillOpen] = useState(false)

  // Submodal: Re-listing & Reviews
  const [isRelistModalOpen, setIsRelistModalOpen] = useState(false)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)

  // Advance Negotiation State (Section 2)
  const [isProposingAdvance, setIsProposingAdvance] = useState(false)
  const [proposedAdvanceAmount, setProposedAdvanceAmount] = useState('')
  const [proposedAdvanceNotes, setProposedAdvanceNotes] = useState('')

  // Rent Adjustment State (Section 4)
  const [isProposingRentAdj, setIsProposingRentAdj] = useState(false)
  const [proposedRentAmount, setProposedRentAmount] = useState('')
  const [proposedRentReason, setProposedRentReason] = useState('')
  const [isRejectingRentAdj, setIsRejectingRentAdj] = useState(false)
  const [rentAdjRejectReason, setRentAdjRejectReason] = useState('')

  // Late Fee Estimate State (Section 5)
  const [lateFeeEstimate, setLateFeeEstimate] = useState<LateFeeEstimate | null>(null)
  const [isLoadingLateFee, setIsLoadingLateFee] = useState(false)

  // Mutual Settlement State (Section 6)
  const [isSigningSettlement, setIsSigningSettlement] = useState(false)

  // Declare Payment Form State
  const [isDeclaringPayment, setIsDeclaringPayment] = useState(false)
  const [paymentPurpose, setPaymentPurpose] = useState<'rent' | 'deposit' | 'adjustment' | 'other'>('rent')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'bank_transfer' | 'cash' | 'other'>('upi')
  const [paymentRef, setPaymentRef] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [uploadedEvidenceUrl, setUploadedEvidenceUrl] = useState('')
  const [isUploadingFile, setIsUploadingFile] = useState(false)

  // Dispute Payment Modal State
  const [disputingPaymentId, setDisputingPaymentId] = useState<number | null>(null)
  const [paymentDisputeReason, setPaymentDisputeReason] = useState('')

  // Propose Adjustment Form State
  const [isProposingAdjustment, setIsProposingAdjustment] = useState(false)
  const [adjType, setAdjType] = useState<'late_fee' | 'damage' | 'cleaning' | 'extension_fee' | 'other'>('late_fee')
  const [adjAmount, setAdjAmount] = useState('')
  const [adjReason, setAdjReason] = useState('')
  const [adjDescription, setAdjDescription] = useState('')

  // Declare Refund Form State
  const [isDeclaringRefund, setIsDeclaringRefund] = useState(false)
  const [refundMethod, setRefundMethod] = useState<'upi' | 'bank_transfer' | 'cash' | 'other'>('upi')
  const [refundRef, setRefundRef] = useState('')
  const [refundNotes, setRefundNotes] = useState('')

  // Dispute Refund State
  const [isDisputingRefund, setIsDisputingRefund] = useState(false)
  const [refundDisputeReason, setRefundDisputeReason] = useState('')

  const loadFinancials = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setActionError(null)
    try {
      const res = await getBookingFinancials(bookingId)
      setData(res)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load financial records.')
    } finally {
      setIsLoading(false)
    }
  }, [bookingId])

  useEffect(() => {
    if (isOpen) {
      loadFinancials()
    }
  }, [isOpen, loadFinancials])

  if (!isOpen) return null

  const s = data?.summary
  const isLender = data?.is_lender ?? false
  const isBorrower = data?.is_borrower ?? false

  // Handle File Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingFile(true)
    try {
      const uploadRes = await uploadPaymentEvidence(file)
      setUploadedEvidenceUrl(uploadRes.evidence_url)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to upload evidence screenshot.')
    } finally {
      setIsUploadingFile(false)
    }
  }

  // Submit Payment Declaration
  const handleDeclarePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setActionError('Please enter a valid payment amount greater than zero.')
      return
    }
    setIsSubmitting(true)
    setActionError(null)
    try {
      await declarePayment(bookingId, {
        purpose: paymentPurpose,
        amount: paymentAmount,
        payment_method: paymentMethod,
        transaction_reference: paymentRef,
        evidence_url: uploadedEvidenceUrl,
        payer_notes: paymentNotes,
      })
      setIsDeclaringPayment(false)
      setPaymentAmount('')
      setPaymentRef('')
      setPaymentNotes('')
      setUploadedEvidenceUrl('')
      loadFinancials()
      onUpdated?.()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to declare payment.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Confirm Payment Receipt
  const handleConfirmPayment = async (paymentId: number) => {
    setIsSubmitting(true)
    setActionError(null)
    try {
      await confirmPayment(paymentId)
      loadFinancials()
      onUpdated?.()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to confirm payment.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Dispute Payment
  const handleDisputePaymentSubmit = async (paymentId: number) => {
    if (!paymentDisputeReason.trim()) {
      alert('Please provide a reason for disputing this payment declaration.')
      return
    }
    setIsSubmitting(true)
    setActionError(null)
    try {
      await disputePayment(paymentId, paymentDisputeReason)
      setDisputingPaymentId(null)
      setPaymentDisputeReason('')
      loadFinancials()
      onUpdated?.()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to dispute payment.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Propose Adjustment Submit
  const handleProposeAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjAmount || Number(adjAmount) <= 0 || !adjReason.trim()) {
      setActionError('Please provide a valid amount and reason.')
      return
    }
    setIsSubmitting(true)
    setActionError(null)
    try {
      await proposeAdjustment(bookingId, {
        adjustment_type: adjType,
        amount: adjAmount,
        reason: adjReason,
        description: adjDescription,
      })
      setIsProposingAdjustment(false)
      setAdjAmount('')
      setAdjReason('')
      setAdjDescription('')
      loadFinancials()
      onUpdated?.()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to propose adjustment.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Respond to Adjustment
  const handleRespondAdjustment = async (adjId: number, action: 'accept' | 'dispute') => {
    setIsSubmitting(true)
    setActionError(null)
    try {
      await respondAdjustment(adjId, { action })
      loadFinancials()
      onUpdated?.()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : `Failed to ${action} adjustment.`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Declare Refund Submit
  const handleDeclareRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setActionError(null)
    try {
      await declareDepositRefund(bookingId, {
        refund_method: refundMethod,
        transaction_reference: refundRef,
        notes: refundNotes,
      })
      setIsDeclaringRefund(false)
      setRefundRef('')
      setRefundNotes('')
      loadFinancials()
      onUpdated?.()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to declare refund.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Confirm / Dispute Refund
  const handleRefundAction = async (action: 'confirm' | 'dispute') => {
    if (action === 'dispute' && !refundDisputeReason.trim()) {
      alert('Please specify why you are disputing the deposit refund.')
      return
    }
    setIsSubmitting(true)
    setActionError(null)
    try {
      await confirmDepositRefund(bookingId, {
        action,
        dispute_reason: refundDisputeReason,
      })
      setIsDisputingRefund(false)
      setRefundDisputeReason('')
      loadFinancials()
      onUpdated?.()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : `Failed to ${action} refund.`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Propose Advance (Section 2)
  const handleProposeAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!proposedAdvanceAmount || Number(proposedAdvanceAmount) < 0) {
      setActionError('Please enter a valid advance amount.')
      return
    }
    setIsSubmitting(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      const res = await proposeAdvancePayment(bookingId, {
        proposed_amount: proposedAdvanceAmount,
        notes: proposedAdvanceNotes,
      })
      setIsProposingAdvance(false)
      setProposedAdvanceAmount('')
      setProposedAdvanceNotes('')
      setActionSuccess(res.message)
      loadFinancials()
      onUpdated?.()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to propose revised advance.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Respond to Advance (Section 2)
  const handleRespondAdvance = async (action: 'accept' | 'reject') => {
    setIsSubmitting(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      const res = await respondAdvancePayment(bookingId, { action })
      setActionSuccess(res.message)
      loadFinancials()
      onUpdated?.()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : `Failed to ${action} advance proposal.`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Propose Rent Adjustment (Section 4)
  const handleProposeRentAdjSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!proposedRentAmount || Number(proposedRentAmount) < 0 || !proposedRentReason.trim()) {
      setActionError('Please enter a valid proposed rent and reason.')
      return
    }
    setIsSubmitting(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      const res = await proposeRentAdjustment(bookingId, {
        proposed_rent: proposedRentAmount,
        reason: proposedRentReason,
      })
      setIsProposingRentAdj(false)
      setProposedRentAmount('')
      setProposedRentReason('')
      setActionSuccess(res.message)
      loadFinancials()
      onUpdated?.()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to propose rent adjustment.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Respond to Rent Adjustment (Section 4)
  const handleRespondRentAdj = async (action: 'accept' | 'reject') => {
    if (action === 'reject' && !rentAdjRejectReason.trim()) {
      alert('Please provide a reason for rejecting the rent adjustment.')
      return
    }
    setIsSubmitting(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      const res = await respondRentAdjustment(bookingId, {
        action,
        reason: rentAdjRejectReason,
      })
      setIsRejectingRentAdj(false)
      setRentAdjRejectReason('')
      setActionSuccess(res.message)
      loadFinancials()
      onUpdated?.()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : `Failed to ${action} rent adjustment.`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Fetch Late Fee Estimate (Section 5)
  const handleFetchLateFee = async () => {
    setIsLoadingLateFee(true)
    try {
      const est = await getLateFeeEstimate(bookingId)
      setLateFeeEstimate(est)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Could not fetch late fee estimate.')
    } finally {
      setIsLoadingLateFee(false)
    }
  }

  // Mutual Settlement Sign-Off (Section 6)
  const handleSignSettlement = async () => {
    setIsSigningSettlement(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      const res = await agreeToSettlement(bookingId)
      setActionSuccess(res.message)
      loadFinancials()
      onUpdated?.()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to sign off on settlement.')
    } finally {
      setIsSigningSettlement(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-[#FBF8F3] rounded-t-3xl sm:rounded-3xl max-w-2xl w-full border border-stone-200/80 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[90vh]">
          {/* Mobile Drag Indicator */}
          <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

          {/* Header */}
          <div className="p-3.5 sm:p-5 bg-white border-b border-stone-200/80 flex items-center justify-between">
            <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#1B3B2B] text-amber-100 flex items-center justify-center shadow-inner shrink-0">
                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-amber-200" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
                  <h3 className="font-bold text-stone-900 text-xs sm:text-base truncate">
                    Financial Records & Peer Settlement
                  </h3>
                  {s && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-stone-100 text-stone-700 font-mono shrink-0">
                      #{bookingId}
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-stone-500 truncate">
                  Direct peer payment declarations, adjustments & deposit tracking
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => setIsBillOpen(true)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold text-emerald-800 hover:bg-emerald-50 border border-emerald-200 transition-colors flex items-center space-x-1 cursor-pointer"
                title="View printable settlement bill"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">View Bill</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
            {isLoading ? (
              <div className="py-16 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-7 h-7 text-[#1B3B2B] animate-spin" />
                <p className="text-xs font-medium text-stone-500">Loading financial records...</p>
              </div>
            ) : error ? (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                <AlertCircle className="w-4 h-4 mb-1 text-rose-600" />
                <p>{error}</p>
              </div>
            ) : data && s ? (
              <>
                {/* Platform Architecture Notice */}
                <div className="p-3.5 rounded-2xl bg-stone-100/80 border border-stone-200/90 text-xs text-stone-700 flex items-start space-x-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong className="text-stone-900 font-semibold">Direct Peer Transactions:</strong> CampusShare never holds, collects, or transfers money. All payments and refunds are transferred directly between parties via UPI, cash, or bank transfer. Records here maintain an auditable, mutual declaration history.
                  </p>
                </div>

                {actionError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{actionError}</span>
                  </div>
                )}

                {/* Financial Terms Snapshot Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-2xl bg-white border border-stone-200/80 text-xs shadow-xs">
                    <span className="text-[10px] uppercase font-mono text-stone-400 block font-bold">
                      Base Rental
                    </span>
                    <span className="font-extrabold text-stone-900 text-sm">
                      ₹{s.agreed_base_rent}
                    </span>
                    <span className="text-[10px] text-stone-500 block">
                      Confirmed: ₹{s.rent_confirmed}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-white border border-stone-200/80 text-xs shadow-xs">
                    <span className="text-[10px] uppercase font-mono text-stone-400 block font-bold">
                      Security Deposit
                    </span>
                    <span className="font-extrabold text-stone-900 text-sm">
                      ₹{s.agreed_deposit}
                    </span>
                    <span className="text-[10px] text-stone-500 block">
                      Confirmed: ₹{s.deposit_confirmed}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-white border border-stone-200/80 text-xs shadow-xs">
                    <span className="text-[10px] uppercase font-mono text-stone-400 block font-bold">
                      Upfront Due
                    </span>
                    <span className="font-extrabold text-[#1B3B2B] text-sm">
                      ₹{s.total_due_upfront}
                    </span>
                    <span className="text-[10px] text-stone-500 block">
                      Pending: ₹{s.total_outstanding_upfront}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-white border border-stone-200/80 text-xs shadow-xs">
                    <span className="text-[10px] uppercase font-mono text-stone-400 block font-bold">
                      Deposit Refund Due
                    </span>
                    <span className="font-extrabold text-emerald-800 text-sm">
                      ₹{s.net_refundable_deposit}
                    </span>
                  </div>
                </div>

                {actionSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{actionSuccess}</span>
                  </div>
                )}

                {/* ADVANCE PAYMENT & TWO-PARTY CONFIRMATION (Section 2) */}
                {Number(s.agreed_deposit) > 0 && (
                  <div className="p-4 rounded-3xl bg-amber-50/50 border border-amber-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-amber-950 text-xs sm:text-sm">
                            Mutual Advance Payment Confirmation
                          </h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            Number(s.deposit_confirmed) >= Number(s.agreed_deposit)
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}>
                            {Number(s.deposit_confirmed) >= Number(s.agreed_deposit)
                              ? '✓ Advance Confirmed'
                              : 'Pending Lender Confirmation'}
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-800">
                          Agreed Advance: <strong>₹{s.agreed_deposit}</strong> • Declared by Borrower: ₹{s.deposit_declared} • Confirmed by Lender: ₹{s.deposit_confirmed}
                        </p>
                      </div>

                      {isBorrower && !isProposingAdvance && Number(s.deposit_confirmed) < Number(s.agreed_deposit) && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsProposingAdvance(true)
                            setProposedAdvanceAmount(s.agreed_deposit)
                          }}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold text-amber-900 bg-white hover:bg-amber-100/60 border border-amber-300 shadow-2xs transition-all cursor-pointer"
                        >
                          Propose Revised Amount
                        </button>
                      )}
                    </div>

                    <p className="text-[10px] text-stone-600 bg-white/70 p-2.5 rounded-xl border border-amber-200/60 leading-relaxed">
                      <strong>Prerequisite Rule:</strong> Both borrower direct transfer declaration and lender receipt confirmation must be satisfied before pickup QR handover can occur. CampusShare never holds money or operates an escrow wallet.
                    </p>

                    {/* Revised Advance Proposal Form for Borrower */}
                    {isProposingAdvance && (
                      <form onSubmit={handleProposeAdvanceSubmit} className="p-3.5 rounded-2xl bg-white border border-amber-300 space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between pb-1 border-b border-stone-200">
                          <span className="text-xs font-bold text-stone-900">
                            Propose Different Advance Amount
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsProposingAdvance(false)}
                            className="text-stone-400 hover:text-stone-600 text-xs font-semibold cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block text-stone-600 font-medium mb-1">
                              Proposed Advance / Deposit (₹)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              value={proposedAdvanceAmount}
                              onChange={(e) => setProposedAdvanceAmount(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-stone-800 font-bold focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-stone-600 font-medium mb-1">
                              Negotiation Note to Lender
                            </label>
                            <input
                              type="text"
                              value={proposedAdvanceNotes}
                              onChange={(e) => setProposedAdvanceNotes(e.target.value)}
                              placeholder="Reason for revised amount..."
                              className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-stone-800 focus:outline-none"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => setIsProposingAdvance(false)}
                            className="px-3 py-1 rounded text-xs font-semibold text-stone-600 hover:bg-stone-100 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-1.5 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-xs cursor-pointer"
                          >
                            Submit Proposal to Lender
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Lender Approval Controls for Proposed Advance */}
                    {isLender && s.advance_negotiation_status === 'proposed' && (
                      <div className="p-3 rounded-2xl bg-amber-100/60 border border-amber-300 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-amber-950 block">
                            Borrower Proposed Revised Advance: ₹{s.agreed_advance_deposit}
                          </span>
                          <span className="text-[11px] text-amber-800">
                            Do you agree to this updated security deposit?
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleRespondAdvance('reject')}
                            disabled={isSubmitting}
                            className="px-3 py-1 rounded-full text-xs font-semibold text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRespondAdvance('accept')}
                            disabled={isSubmitting}
                            className="px-3.5 py-1 rounded-full text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 shadow-xs cursor-pointer"
                          >
                            Accept Revised Advance
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* DYNAMIC RENT CALCULATION & LENDER PROPOSALS (Sections 3 & 4) */}
                <div className="p-4 rounded-3xl bg-white border border-stone-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-stone-900 text-xs sm:text-sm">
                        Verified Duration & Dynamic Rent Calculation
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        Planned: {s.duration_days} day(s) • Actual Verified: {s.actual_duration_display || `${s.duration_days} day(s)`}
                      </p>
                    </div>

                    {isLender && !isProposingRentAdj && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsProposingRentAdj(true)
                          setProposedRentAmount(s.final_agreed_rent || s.agreed_base_rent)
                        }}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 shadow-2xs transition-all cursor-pointer"
                      >
                        Propose Adjusted Rent
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/80">
                      <span className="text-[10px] uppercase font-mono text-stone-400 block font-bold">Original Rent Estimate</span>
                      <span className="font-extrabold text-stone-900 text-sm">₹{s.original_rent_estimate || s.agreed_base_rent}</span>
                      <span className="text-[10px] text-stone-500 block">Snapshot agreed rate</span>
                    </div>

                    <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/80">
                      <span className="text-[10px] uppercase font-mono text-stone-400 block font-bold">System Calculated Rent</span>
                      <span className="font-extrabold text-stone-900 text-sm">₹{s.system_calculated_rent || s.agreed_base_rent}</span>
                      <span className="text-[10px] text-stone-500 block">Based on verified timestamps</span>
                    </div>

                    <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200 text-emerald-950">
                      <span className="text-[10px] uppercase font-mono text-emerald-700 block font-bold">Final Agreed Rent</span>
                      <span className="font-extrabold text-emerald-900 text-sm">₹{s.final_agreed_rent || s.agreed_base_rent}</span>
                      <span className="text-[10px] text-emerald-700 block capitalize">Terms: {(s.rent_status_label || 'calculated').replace('_', ' ')}</span>
                    </div>
                  </div>

                  {/* Lender Proposed Rent Form */}
                  {isProposingRentAdj && (
                    <form onSubmit={handleProposeRentAdjSubmit} className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between pb-1 border-b border-stone-200">
                        <span className="text-xs font-bold text-stone-900">
                          Propose Custom Final Rent to Borrower
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsProposingRentAdj(false)}
                          className="text-stone-400 hover:text-stone-600 text-xs font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-stone-600 font-medium mb-1">
                            Lender Proposed Rent (₹)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={proposedRentAmount}
                            onChange={(e) => setProposedRentAmount(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-800 font-bold focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-stone-600 font-medium mb-1">
                            Reason for Adjustment
                          </label>
                          <input
                            type="text"
                            required
                            value={proposedRentReason}
                            onChange={(e) => setProposedRentReason(e.target.value)}
                            placeholder="e.g. Returned 2 hours early, offering discount..."
                            className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-800 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => setIsProposingRentAdj(false)}
                          className="px-3 py-1 rounded text-xs font-semibold text-stone-600 hover:bg-stone-100 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="px-4 py-1.5 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-xs cursor-pointer"
                        >
                          Submit Rent Adjustment
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Borrower Response to Proposed Rent Adjustment */}
                  {isBorrower && s.rent_adjustment_status === 'proposed' && (
                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-amber-950 block">
                            Lender Proposed Rent: ₹{s.lender_proposed_rent}
                          </span>
                          <span className="text-[11px] text-amber-800">
                            Reason: {s.rent_adjustment_reason || 'Discretionary adjustment'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => setIsRejectingRentAdj(true)}
                            className="px-3 py-1 rounded-full text-xs font-semibold text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRespondRentAdj('accept')}
                            disabled={isSubmitting}
                            className="px-3.5 py-1 rounded-full text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 shadow-xs cursor-pointer"
                          >
                            Accept Adjusted Rent
                          </button>
                        </div>
                      </div>

                      {isRejectingRentAdj && (
                        <div className="p-3 rounded-xl bg-white border border-rose-200 space-y-2">
                          <label className="block text-[11px] font-bold text-rose-900">
                            Reason for rejecting proposed rent adjustment:
                          </label>
                          <input
                            type="text"
                            value={rentAdjRejectReason}
                            onChange={(e) => setRentAdjRejectReason(e.target.value)}
                            placeholder="e.g. Disagree with proposed rate..."
                            className="w-full p-2 text-xs rounded-lg border border-stone-200"
                          />
                          <div className="flex justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => setIsRejectingRentAdj(false)}
                              className="px-2 py-1 text-xs text-stone-500"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRespondRentAdj('reject')}
                              disabled={isSubmitting}
                              className="px-3 py-1 rounded text-xs font-bold bg-rose-700 text-white"
                            >
                              Confirm Rejection
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* SECTION 1: DIRECT PAYMENT DECLARATIONS */}
                <div className="p-4 rounded-3xl bg-white border border-stone-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-stone-900 text-xs sm:text-sm">
                        Direct Payment Declarations
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        Borrower records direct transfers; recipient confirms receipt
                      </p>
                    </div>

                    {!isDeclaringPayment && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsDeclaringPayment(true)
                          // Pre-fill with outstanding rent or deposit
                          if (Number(s.rent_outstanding) > 0) {
                            setPaymentPurpose('rent')
                            setPaymentAmount(s.rent_outstanding)
                          } else if (Number(s.deposit_outstanding) > 0) {
                            setPaymentPurpose('deposit')
                            setPaymentAmount(s.deposit_outstanding)
                          } else {
                            setPaymentAmount('')
                          }
                        }}
                        className="px-3 py-1.5 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-xs transition-all flex items-center space-x-1 cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Declare Payment</span>
                      </button>
                    )}
                  </div>

                  {/* Payment Declaration Form */}
                  {isDeclaringPayment && (
                    <form
                      onSubmit={handleDeclarePaymentSubmit}
                      className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3 animate-in fade-in"
                    >
                      <div className="flex items-center justify-between pb-1 border-b border-stone-200">
                        <span className="text-xs font-bold text-stone-800">
                          Record Direct Payment Made
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsDeclaringPayment(false)}
                          className="text-stone-400 hover:text-stone-600 text-xs font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-stone-600 font-medium mb-1">
                            Payment Purpose
                          </label>
                          <select
                            value={paymentPurpose}
                            onChange={(e) => {
                              const p = e.target.value as any
                              setPaymentPurpose(p)
                              if (p === 'rent') setPaymentAmount(s.rent_outstanding)
                              else if (p === 'deposit') setPaymentAmount(s.deposit_outstanding)
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#1B3B2B]/20"
                          >
                            <option value="rent">Rental Charge (₹{s.agreed_base_rent})</option>
                            <option value="deposit">Security Deposit (₹{s.agreed_deposit})</option>
                            <option value="adjustment">Additional Fee / Adjustment</option>
                            <option value="other">Other Mutually Agreed</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-stone-600 font-medium mb-1">
                            Amount Transferred (₹)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            required
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            placeholder="e.g. 500.00"
                            className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-800 font-bold focus:outline-none focus:ring-2 focus:ring-[#1B3B2B]/20"
                          />
                        </div>

                        <div>
                          <label className="block text-stone-600 font-medium mb-1">
                            Payment Method
                          </label>
                          <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value as any)}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#1B3B2B]/20"
                          >
                            <option value="upi">UPI (GPay / PhonePe / Paytm / BHIM)</option>
                            <option value="cash">Cash (Direct Handover)</option>
                            <option value="bank_transfer">Direct Bank Transfer (IMPS / NEFT)</option>
                            <option value="other">Other Mutually Agreed</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-stone-600 font-medium mb-1">
                            Transaction Reference / UTR
                          </label>
                          <input
                            type="text"
                            value={paymentRef}
                            onChange={(e) => setPaymentRef(e.target.value)}
                            placeholder="e.g. 12-digit UPI UTR or Cash Note"
                            className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-800 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#1B3B2B]/20"
                          />
                        </div>
                      </div>

                      {/* Evidence Upload */}
                      <div className="text-xs">
                        <label className="block text-stone-600 font-medium mb-1">
                          Payment Screenshot / Receipt (Optional Evidence)
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            onChange={handleFileChange}
                            className="text-xs text-stone-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-stone-200 file:text-stone-700 hover:file:bg-stone-300"
                          />
                          {isUploadingFile && <Loader2 className="w-4 h-4 text-stone-400 animate-spin" />}
                          {uploadedEvidenceUrl && (
                            <span className="text-[11px] text-emerald-700 font-semibold flex items-center space-x-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Attached</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsDeclaringPayment(false)}
                          className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-stone-600 hover:bg-stone-200/60 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting || isUploadingFile}
                          className="px-4 py-1.5 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-xs transition-all flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Recording...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>Submit Declaration</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Payment Records List */}
                  {data.payments.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-stone-50 text-center text-xs text-stone-500">
                      No direct payments have been recorded yet for this booking.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {data.payments.map((p) => {
                        const isDeclared = p.status === 'declared'
                        const isDisputed = p.status === 'disputed'
                        const isConfirmed = p.status === 'confirmed'

                        return (
                          <div
                            key={p.id}
                            className={`p-3 rounded-2xl border text-xs space-y-2 transition-all ${
                              isConfirmed
                                ? 'bg-emerald-50/40 border-emerald-200/80'
                                : isDisputed
                                ? 'bg-rose-50/60 border-rose-200'
                                : 'bg-stone-50 border-stone-200'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isConfirmed
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : isDisputed
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {p.status_display}
                                </span>
                                <span className="font-bold text-stone-900 text-sm">
                                  ₹{p.amount}
                                </span>
                                <span className="text-stone-500 capitalize">
                                  ({p.purpose_display})
                                </span>
                              </div>

                              <div className="text-stone-500 font-mono text-[11px]">
                                {new Date(p.declared_at).toLocaleDateString()} via {p.payment_method_display}
                              </div>
                            </div>

                            <div className="text-[11px] text-stone-600 flex flex-wrap gap-x-4 gap-y-1">
                              <span>Payer: <strong>{p.payer.full_name || p.payer.username}</strong></span>
                              <span>Recipient: <strong>{p.recipient.full_name || p.recipient.username}</strong></span>
                              {p.transaction_reference && (
                                <span className="font-mono text-stone-700">Ref: {p.transaction_reference}</span>
                              )}
                              {p.evidence_url && (
                                <a
                                  href={p.evidence_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-700 hover:underline flex items-center space-x-1"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>View Proof</span>
                                </a>
                              )}
                            </div>

                            {p.dispute_reason && (
                              <div className="p-2 rounded-xl bg-rose-100/70 text-rose-900 text-[11px] font-medium">
                                <strong>Dispute Reason:</strong> {p.dispute_reason}
                              </div>
                            )}

                            {/* Recipient Action Controls */}
                            {isDeclared && (
                              <div className="pt-2 border-t border-stone-200/60 flex items-center justify-end space-x-2">
                                <button
                                  type="button"
                                  onClick={() => setDisputingPaymentId(p.id)}
                                  className="px-3 py-1 rounded-full text-xs font-semibold text-rose-700 hover:bg-rose-100/60 transition-colors cursor-pointer"
                                >
                                  Report Discrepancy
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleConfirmPayment(p.id)}
                                  disabled={isSubmitting}
                                  className="px-3.5 py-1 rounded-full text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 shadow-xs transition-all flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Confirm Receipt</span>
                                </button>
                              </div>
                            )}

                            {/* Dispute Prompt */}
                            {disputingPaymentId === p.id && (
                              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-2 animate-in fade-in">
                                <span className="text-xs font-bold text-rose-900 block">
                                  State Reason for Disputing This Declaration:
                                </span>
                                <textarea
                                  rows={2}
                                  value={paymentDisputeReason}
                                  onChange={(e) => setPaymentDisputeReason(e.target.value)}
                                  placeholder="e.g. Received incorrect amount, bank transaction not received..."
                                  className="w-full p-2 text-xs rounded-lg border border-rose-300 bg-white text-stone-800 focus:outline-none"
                                />
                                <div className="flex justify-end space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => setDisputingPaymentId(null)}
                                    className="px-2.5 py-1 rounded text-xs font-semibold text-stone-600 hover:bg-stone-200/60 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDisputePaymentSubmit(p.id)}
                                    disabled={isSubmitting}
                                    className="px-3 py-1 rounded text-xs font-bold bg-rose-700 hover:bg-rose-800 text-white cursor-pointer"
                                  >
                                    Confirm Dispute
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* SECTION 2: SETTLEMENT ADJUSTMENTS & DEDUCTIONS */}
                <div className="p-4 rounded-3xl bg-white border border-stone-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-stone-900 text-xs sm:text-sm">
                        Adjustments & Late / Damage Claims
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        Mutually agreed deductions alter refundable deposit; disputed claims are preserved
                      </p>
                    </div>

                    {!isProposingAdjustment && (
                      <button
                        type="button"
                        onClick={() => setIsProposingAdjustment(true)}
                        className="px-3 py-1.5 rounded-full text-xs font-bold text-stone-700 hover:bg-stone-100 border border-stone-200 shadow-xs transition-all flex items-center space-x-1 cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Propose Adjustment</span>
                      </button>
                    )}
                  </div>

                  {/* Propose Adjustment Form */}
                  {isProposingAdjustment && (
                    <form
                      onSubmit={handleProposeAdjustmentSubmit}
                      className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-3 animate-in fade-in"
                    >
                      <div className="flex items-center justify-between pb-1 border-b border-amber-200">
                        <span className="text-xs font-bold text-amber-950">
                          Propose Settlement Adjustment
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsProposingAdjustment(false)}
                          className="text-stone-400 hover:text-stone-600 text-xs font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-stone-600 font-medium mb-1">
                            Adjustment Type
                          </label>
                          <select
                            value={adjType}
                            onChange={(e) => {
                              const val = e.target.value as any
                              setAdjType(val)
                              if (val === 'late_fee') {
                                handleFetchLateFee()
                              }
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-800 font-medium focus:outline-none"
                          >
                            <option value="late_fee">Late Return Fee</option>
                            <option value="damage">Item Damage Claim</option>
                            <option value="cleaning">Cleaning / Maintenance Fee</option>
                            <option value="extension_fee">Rental Extension Charge</option>
                            <option value="other">Other Agreed Adjustment</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-stone-600 font-medium mb-1">
                            Amount (₹)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            required
                            value={adjAmount}
                            onChange={(e) => setAdjAmount(e.target.value)}
                            placeholder="e.g. 150.00"
                            className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-800 font-bold focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Late Fee Calculation Helper */}
                      {adjType === 'late_fee' && (
                        <div className="p-2.5 rounded-xl bg-amber-100/60 border border-amber-200 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-950 flex items-center space-x-1">
                              <Clock className="w-3.5 h-3.5 text-amber-800" />
                              <span>Agreed Policy Late Fee Calculator</span>
                            </span>
                            <button
                              type="button"
                              onClick={handleFetchLateFee}
                              disabled={isLoadingLateFee}
                              className="text-[11px] font-semibold text-amber-900 underline hover:text-amber-950"
                            >
                              {isLoadingLateFee ? 'Calculating...' : 'Recalculate'}
                            </button>
                          </div>

                          {lateFeeEstimate ? (
                            <div className="space-y-1 text-[11px] text-amber-900">
                              <p>
                                <strong>Status:</strong> {lateFeeEstimate.message}
                              </p>
                              <div className="flex items-center justify-between pt-1">
                                <span>Suggested Policy Fee: <strong>₹{lateFeeEstimate.suggested_late_fee}</strong></span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAdjAmount(String(lateFeeEstimate.suggested_late_fee))
                                    setAdjReason(lateFeeEstimate.message || '')
                                  }}
                                  className="px-2 py-0.5 rounded-md bg-amber-800 text-white font-bold text-[10px] hover:bg-amber-900"
                                >
                                  Apply Suggested Fee
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-amber-800">
                              Calculates late fee based on verified return vs agreed due time with standard 2-hour grace period.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Damage Claim Notice */}
                      {adjType === 'damage' && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-900 space-y-1">
                          <div className="flex items-center space-x-1 font-bold">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-700" />
                            <span>Damage Penalty Policy</span>
                          </div>
                          <p>
                            Damage penalties require a clear factual description and borrower acceptance. Disputed claims will not deduct funds automatically until mutually agreed or resolved.
                          </p>
                        </div>
                      )}

                      <div className="text-xs">
                        <label className="block text-stone-600 font-medium mb-1">
                          Reason / Description
                        </label>
                        <input
                          type="text"
                          required
                          value={adjReason}
                          onChange={(e) => setAdjReason(e.target.value)}
                          placeholder="e.g. 2 hours late return per agreed policy"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-800 focus:outline-none"
                        />
                      </div>

                      <div className="flex justify-end space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsProposingAdjustment(false)}
                          className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-stone-600 hover:bg-stone-200/60 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="px-4 py-1.5 rounded-full text-xs font-bold text-white bg-amber-800 hover:bg-amber-900 shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          Submit Proposal
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Adjustments List */}
                  {data.adjustments.length === 0 ? (
                    <div className="p-3 rounded-2xl bg-stone-50 text-center text-xs text-stone-500">
                      No adjustments or deduction claims have been proposed.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {data.adjustments.map((adj) => {
                        const isProposed = adj.status === 'proposed'
                        const isAccepted = adj.status === 'accepted'
                        const isDisputed = adj.status === 'disputed'

                        return (
                          <div
                            key={adj.id}
                            className={`p-3 rounded-2xl border text-xs space-y-2 ${
                              isAccepted
                                ? 'bg-amber-50/50 border-amber-200'
                                : isDisputed
                                ? 'bg-rose-50/50 border-rose-200'
                                : 'bg-stone-50 border-stone-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isAccepted
                                      ? 'bg-amber-100 text-amber-900'
                                      : isDisputed
                                      ? 'bg-rose-100 text-rose-900'
                                      : 'bg-stone-200 text-stone-700'
                                  }`}
                                >
                                  {adj.status_display}
                                </span>
                                <span className="font-bold text-stone-900 text-sm">
                                  ₹{adj.amount}
                                </span>
                                <span className="text-stone-500">
                                  ({adj.adjustment_type_display})
                                </span>
                              </div>
                              <span className="text-[11px] text-stone-400 font-mono">
                                Proposed by {adj.proposed_by.full_name || adj.proposed_by.username}
                              </span>
                            </div>

                            <p className="text-stone-700 font-medium text-[11px]">
                              {adj.reason}
                            </p>

                            {/* Action Buttons for Counterpart */}
                            {isProposed && (
                              <div className="pt-2 border-t border-stone-200/60 flex items-center justify-end space-x-2">
                                <button
                                  type="button"
                                  onClick={() => handleRespondAdjustment(adj.id, 'dispute')}
                                  disabled={isSubmitting}
                                  className="px-3 py-1 rounded-full text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 cursor-pointer"
                                >
                                  Dispute
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRespondAdjustment(adj.id, 'accept')}
                                  disabled={isSubmitting}
                                  className="px-3.5 py-1 rounded-full text-xs font-bold text-white bg-amber-800 hover:bg-amber-900 shadow-xs cursor-pointer"
                                >
                                  Accept Deduction
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* SECTION 3: DEPOSIT REFUND RECONCILIATION */}
                {Number(s.agreed_deposit) > 0 && (
                  <div className="p-4 rounded-3xl bg-white border border-stone-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-stone-900 text-xs sm:text-sm">
                          Security Deposit Refund Reconciliation
                        </h4>
                        <p className="text-[11px] text-stone-500">
                          Net Refund Due: ₹{s.net_refundable_deposit} (Original ₹{s.agreed_deposit} - Approved ₹{s.approved_deductions})
                        </p>
                      </div>

                      {isLender && !data.deposit_refund && !isDeclaringRefund && (
                        <button
                          type="button"
                          onClick={() => setIsDeclaringRefund(true)}
                          className="px-3 py-1.5 rounded-full text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 shadow-xs transition-all flex items-center space-x-1 cursor-pointer"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Declare Refund Sent</span>
                        </button>
                      )}
                    </div>

                    {/* Declare Refund Form */}
                    {isDeclaringRefund && (
                      <form
                        onSubmit={handleDeclareRefundSubmit}
                        className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3 animate-in fade-in"
                      >
                        <div className="flex items-center justify-between pb-1 border-b border-emerald-200">
                          <span className="text-xs font-bold text-emerald-950">
                            Declare Direct Deposit Refund to Borrower
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsDeclaringRefund(false)}
                            className="text-stone-400 hover:text-stone-600 text-xs font-semibold cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>

                        <div className="p-2.5 rounded-xl bg-white border border-emerald-200 text-xs">
                          <span className="text-emerald-900 font-bold block">
                            Calculated Net Refund: ₹{s.net_refundable_deposit}
                          </span>
                          <p className="text-[11px] text-emerald-700">
                            Transfer this amount directly to the borrower via your agreed method.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block text-stone-600 font-medium mb-1">
                              Refund Method
                            </label>
                            <select
                              value={refundMethod}
                              onChange={(e) => setRefundMethod(e.target.value as any)}
                              className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-800 font-medium focus:outline-none"
                            >
                              <option value="upi">UPI (GPay / PhonePe / Paytm / BHIM)</option>
                              <option value="cash">Cash (Direct Handover)</option>
                              <option value="bank_transfer">Direct Bank Transfer (IMPS / NEFT)</option>
                              <option value="other">Other Mutually Agreed</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-stone-600 font-medium mb-1">
                              Refund Reference / UTR
                            </label>
                            <input
                              type="text"
                              value={refundRef}
                              onChange={(e) => setRefundRef(e.target.value)}
                              placeholder="e.g. UPI UTR number or cash note"
                              className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-800 font-mono text-xs focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end space-x-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsDeclaringRefund(false)}
                            className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-stone-600 hover:bg-stone-200/60 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-1.5 rounded-full text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            Record Refund Declaration
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Deposit Refund Card if exists */}
                    {data.deposit_refund ? (
                      <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                data.deposit_refund.status === 'confirmed'
                                  ? 'bg-emerald-200 text-emerald-900'
                                  : data.deposit_refund.status === 'disputed'
                                  ? 'bg-rose-100 text-rose-900'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {data.deposit_refund.status_display}
                            </span>
                            <span className="font-extrabold text-stone-900 text-sm">
                              ₹{data.deposit_refund.net_refund_amount}
                            </span>
                          </div>
                          <span className="text-[11px] text-stone-500 font-mono">
                            via {data.deposit_refund.refund_method_display}
                          </span>
                        </div>

                        {data.deposit_refund.transaction_reference && (
                          <p className="text-[11px] text-stone-600 font-mono">
                            Ref: {data.deposit_refund.transaction_reference}
                          </p>
                        )}

                        {data.deposit_refund.dispute_reason && (
                          <div className="p-2 rounded-xl bg-rose-100/70 text-rose-900 text-[11px] font-medium">
                            <strong>Dispute:</strong> {data.deposit_refund.dispute_reason}
                          </div>
                        )}

                        {/* Borrower Refund Confirmation Controls */}
                        {isBorrower && data.deposit_refund.status === 'declared' && (
                          <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => setIsDisputingRefund(true)}
                              className="px-3 py-1 rounded-full text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 cursor-pointer"
                            >
                              Dispute Refund
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRefundAction('confirm')}
                              disabled={isSubmitting}
                              className="px-3.5 py-1 rounded-full text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 shadow-xs cursor-pointer"
                            >
                              Confirm Refund Received
                            </button>
                          </div>
                        )}

                        {isDisputingRefund && (
                          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-2 animate-in fade-in">
                            <span className="text-xs font-bold text-rose-900 block">
                              Reason for Disputing Deposit Refund:
                            </span>
                            <textarea
                              rows={2}
                              value={refundDisputeReason}
                              onChange={(e) => setRefundDisputeReason(e.target.value)}
                              placeholder="e.g. Refund not received in bank account..."
                              className="w-full p-2 text-xs rounded-lg border border-rose-300 bg-white text-stone-800 focus:outline-none"
                            />
                            <div className="flex justify-end space-x-2">
                              <button
                                type="button"
                                onClick={() => setIsDisputingRefund(false)}
                                className="px-2.5 py-1 rounded text-xs font-semibold text-stone-600 hover:bg-stone-200/60 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRefundAction('dispute')}
                                disabled={isSubmitting}
                                className="px-3 py-1 rounded text-xs font-bold bg-rose-700 hover:bg-rose-800 text-white cursor-pointer"
                              >
                                Submit Dispute
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 rounded-2xl bg-stone-50 text-center text-xs text-stone-500">
                        Deposit refund will be declared by the lender once the item is returned.
                      </div>
                    )}
                  </div>
                )}

                {/* SECTION 4: MUTUAL FINAL SETTLEMENT (SECTION 6 & 7) */}
                <div className="p-4 rounded-3xl bg-white border border-stone-200/80 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-stone-900 text-xs sm:text-sm flex items-center space-x-1.5">
                        <Scale className="w-4 h-4 text-[#1B3B2B]" />
                        <span>Mutual Final Settlement Sign-Off</span>
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        Itemized terms agreement is distinct from direct money transfer confirmation
                      </p>
                    </div>

                    {/* Settlement Status Badge */}
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          s.settlement_status === 'settled'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : s.settlement_status === 'disputed'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : s.settlement_status === 'agreed_payment_pending'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : s.settlement_status === 'payment_declared'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : s.settlement_status === 'receipt_confirmed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : s.settlement_status === 'awaiting_borrower_confirmation'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : s.settlement_status === 'awaiting_lender_confirmation'
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : 'bg-stone-100 text-stone-700 border border-stone-200'
                        }`}
                      >
                        {s.settlement_status_display || s.settlement_status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Two-Party Sign-Off Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div
                      className={`p-3 rounded-2xl border flex items-center justify-between ${
                        s.borrower_agreed_settlement
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                          : 'bg-stone-50 border-stone-200 text-stone-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        {s.borrower_agreed_settlement ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        ) : (
                          <Clock className="w-4 h-4 text-stone-400" />
                        )}
                        <div>
                          <div className="font-bold">Borrower Sign-Off</div>
                          <div className="text-[10px] text-stone-500 font-medium">
                            {s.borrower_agreed_settlement ? 'Agreed to itemized terms' : 'Pending review'}
                          </div>
                        </div>
                      </div>
                      {isBorrower && !s.borrower_agreed_settlement && (
                        <button
                          type="button"
                          onClick={handleSignSettlement}
                          disabled={isSigningSettlement}
                          className="px-3 py-1.5 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isSigningSettlement ? 'Signing...' : 'Sign Off'}
                        </button>
                      )}
                    </div>

                    <div
                      className={`p-3 rounded-2xl border flex items-center justify-between ${
                        s.lender_agreed_settlement
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                          : 'bg-stone-50 border-stone-200 text-stone-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        {s.lender_agreed_settlement ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        ) : (
                          <Clock className="w-4 h-4 text-stone-400" />
                        )}
                        <div>
                          <div className="font-bold">Lender Sign-Off</div>
                          <div className="text-[10px] text-stone-500 font-medium">
                            {s.lender_agreed_settlement ? 'Agreed to itemized terms' : 'Pending review'}
                          </div>
                        </div>
                      </div>
                      {isLender && !s.lender_agreed_settlement && (
                        <button
                          type="button"
                          onClick={handleSignSettlement}
                          disabled={isSigningSettlement}
                          className="px-3 py-1.5 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isSigningSettlement ? 'Signing...' : 'Sign Off'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Settlement Disclaimer */}
                  <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed">
                    <strong>Mandatory Notice:</strong> CampusShare-generated transaction record. Payments and refunds are handled directly between the parties. This document records the terms and confirmations stored on CampusShare and is not independent proof of bank settlement.
                  </div>
                </div>

                {/* SECTION 5: POST-RETURN ACTIONS (RE-LISTING & REVIEWS) */}
                {(data.booking?.status === 'returned' || data.booking?.status === 'completed' || s.actual_return_time) && (
                  <div className="p-4 rounded-3xl bg-stone-100/80 border border-stone-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-stone-900 text-xs sm:text-sm">
                          Completed Rental Lifecycle Actions
                        </h4>
                        <p className="text-[11px] text-stone-500">
                          Physical return verified — finalize re-listing and peer reviews
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2.5 pt-1">
                      {isLender && (
                        <button
                          type="button"
                          onClick={() => setIsRelistModalOpen(true)}
                          className="px-4 py-2 rounded-2xl text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-xs flex items-center space-x-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-amber-200" />
                          <span>Re-list Listing Choice (Yes / Edit / No)</span>
                        </button>
                      )}

                      {isBorrower && (
                        <button
                          type="button"
                          onClick={() => setIsReviewModalOpen(true)}
                          className="px-4 py-2 rounded-2xl text-xs font-bold text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 shadow-xs flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Star className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                          <span>Write Reviews (Product & Lender)</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Itemized Printable Bill Modal */}
      <SettlementBillModal
        bookingId={bookingId}
        isOpen={isBillOpen}
        onClose={() => setIsBillOpen(false)}
      />

      {/* Re-listing Choice Modal (Section 9) */}
      <RelistChoiceModal
        booking={data?.booking || initialBooking || null}
        isOpen={isRelistModalOpen}
        onClose={() => setIsRelistModalOpen(false)}
        onRelisted={() => {
          loadFinancials()
          onUpdated?.()
        }}
      />

      {/* Reviews Modal (Section 10) */}
      <ReviewModal
        booking={data?.booking || initialBooking || null}
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onReviewSubmitted={() => {
          loadFinancials()
          onUpdated?.()
        }}
      />
    </>
  )
}
