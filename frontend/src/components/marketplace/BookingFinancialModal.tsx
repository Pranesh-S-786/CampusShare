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
} from 'lucide-react'
import {
  type BookingFinancialsResponse,
  getBookingFinancials,
  declarePayment,
  confirmPayment,
  disputePayment,
  proposeAdjustment,
  respondAdjustment,
  declareDepositRefund,
  confirmDepositRefund,
  uploadPaymentEvidence,
} from '../../services/api'
import { SettlementBillModal } from './SettlementBillModal'

interface BookingFinancialModalProps {
  bookingId: number
  isOpen: boolean
  onClose: () => void
  onUpdated?: () => void
}

export function BookingFinancialModal({
  bookingId,
  isOpen,
  onClose,
  onUpdated,
}: BookingFinancialModalProps) {
  const [data, setData] = useState<BookingFinancialsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Submodal: Printable Bill
  const [isBillOpen, setIsBillOpen] = useState(false)

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

  return (
    <>
      <div className="fixed inset-0 z-40 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
        <div className="bg-[#FBF8F3] rounded-3xl max-w-2xl w-full border border-stone-200/80 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="p-4 sm:p-5 bg-white border-b border-stone-200/80 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-[#1B3B2B] text-amber-100 flex items-center justify-center shadow-inner">
                <CreditCard className="w-5 h-5 text-amber-200" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-stone-900 text-sm sm:text-base">
                    Financial Records & Peer Settlement
                  </h3>
                  {s && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700 font-mono">
                      Booking #{bookingId}
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500">
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
                    <span className="text-[10px] text-stone-500 block capitalize">
                      Status: {s.refund_status.replace('_', ' ')}
                    </span>
                  </div>
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
                            onChange={(e) => setAdjType(e.target.value as any)}
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
    </>
  )
}
