import { useState, useEffect, useCallback } from 'react'
import {
  X,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Send,
  Check,
  Clock,
  RotateCw,
} from 'lucide-react'
import {
  type Booking,
  type PaymentRecordItem,
  getBookingFinancials,
  declarePayment,
  confirmPayment,
  disputePayment,
} from '../../services/api'

interface AdvancePaymentModalProps {
  booking: Booking | null
  isLender: boolean
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function AdvancePaymentModal({
  booking,
  isLender,
  isOpen,
  onClose,
  onSuccess,
}: AdvancePaymentModalProps) {
  const [depositPayment, setDepositPayment] = useState<PaymentRecordItem | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'cash' | 'bank_transfer'>('upi')
  const [txRef, setTxRef] = useState('')
  const [disputeReason, setDisputeReason] = useState('')
  const [showDisputeInput, setShowDisputeInput] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const agreedAmount = booking
    ? Number(booking.agreed_advance_amount ?? booking.snapshot_deposit_amount ?? 0)
    : 0

  const isNoAdvanceApplicable = agreedAmount <= 0
  const isConfirmed = depositPayment?.status === 'confirmed'
  const isDeclared = depositPayment?.status === 'declared'
  const isDisputed = depositPayment?.status === 'disputed'

  const loadFinancials = useCallback(async (isManualRefresh = false) => {
    if (!booking) return
    if (isManualRefresh) setIsRefreshing(true)
    try {
      const fin = await getBookingFinancials(booking.id)
      const relevantPayments = fin.payments.filter(
        (p) =>
          p.purpose === 'deposit' ||
          (p.purpose as string) === 'advance' ||
          (agreedAmount > 0 && Math.abs(Number(p.amount) - agreedAmount) < 0.01)
      )
      const dep =
        relevantPayments.find((p) => p.status === 'declared') ||
        relevantPayments.find((p) => p.status === 'confirmed') ||
        (relevantPayments.length > 0 ? relevantPayments[relevantPayments.length - 1] : null)

      setDepositPayment(dep)
      setError(null)
    } catch (err: unknown) {
      if (isManualRefresh) {
        setError(err instanceof Error ? err.message : 'Failed to refresh advance payment records.')
      }
    } finally {
      if (isManualRefresh) setIsRefreshing(false)
    }
  }, [booking, agreedAmount])

  // Initial load
  useEffect(() => {
    if (!isOpen || !booking) return
    setIsLoading(true)
    loadFinancials().finally(() => {
      setIsLoading(false)
    })
  }, [isOpen, booking, loadFinancials])

  // Polling every 2.5 seconds while open until payment is confirmed
  useEffect(() => {
    if (!isOpen || !booking || isConfirmed) return

    const interval = setInterval(() => {
      loadFinancials()
    }, 2500)

    return () => clearInterval(interval)
  }, [isOpen, booking, isConfirmed, loadFinancials])

  if (!isOpen || !booking) return null

  // Borrower declares advance payment
  const handleMarkAsPaid = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const res = await declarePayment(booking.id, {
        purpose: 'deposit',
        amount: agreedAmount,
        payment_method: paymentMethod,
        transaction_reference: txRef.trim() || undefined,
        payer_notes: `Agreed advance/security deposit paid via ${paymentMethod}`,
      })
      setDepositPayment(res.payment)
      setSuccessMsg('Advance payment declared! Awaiting lender confirmation.')
      onSuccess?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to declare payment.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Lender confirms receipt of advance payment
  const handleConfirmReceived = async () => {
    setIsSubmitting(true)
    setError(null)
    setSuccessMsg(null)

    try {
      if (depositPayment && depositPayment.status === 'declared') {
        const res = await confirmPayment(depositPayment.id)
        setDepositPayment(res.payment)
        setSuccessMsg('Advance payment confirmed by lender.')
      } else if (depositPayment && depositPayment.status === 'confirmed') {
        setSuccessMsg('Advance payment is already confirmed.')
      } else {
        // Direct confirmation by lender if borrower paid offline (cash/UPI) without prior declaration
        const res = await declarePayment(booking.id, {
          purpose: 'deposit',
          amount: agreedAmount,
          payment_method: 'cash',
          payer_notes: 'Advance receipt confirmed directly by lender',
          confirm_as_recipient: true,
        })
        setDepositPayment(res.payment)
        setSuccessMsg('Advance payment confirmed by lender.')
      }
      onSuccess?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to confirm receipt.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Lender disputes payment
  const handleDispute = async () => {
    if (!depositPayment) return
    if (!disputeReason.trim()) {
      setError('Please provide a reason for disputing this payment declaration.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const res = await disputePayment(depositPayment.id, disputeReason.trim())
      setDepositPayment(res.payment)
      setShowDisputeInput(false)
      setError('Payment declaration has been challenged. Status recorded for audit.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to dispute payment.')
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
              <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-800" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-stone-900 text-xs sm:text-base">
                Advance Payment Confirmation
              </h3>
              <p className="text-[11px] sm:text-xs text-stone-500 font-mono truncate max-w-[220px] sm:max-w-[260px]">
                {booking.listing.title} • Handover Complete
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1 shrink-0">
            <button
              type="button"
              onClick={() => loadFinancials(true)}
              disabled={isRefreshing || isLoading}
              title="Refresh payment status"
              className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
            >
              <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-800' : ''}`} />
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

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs text-stone-700">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2 text-stone-400">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-800" />
              <span className="text-xs">Loading payment details...</span>
            </div>
          ) : isNoAdvanceApplicable ? (
            <div className="p-4 rounded-2xl bg-white border border-stone-200 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-700 mx-auto" />
              <h4 className="font-bold text-stone-900 text-sm">No Advance Required</h4>
              <p className="text-stone-500 text-xs max-w-sm mx-auto">
                No advance or deposit amount was required for this rental. Item handover has been verified and your rental is now active!
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 py-2 px-6 rounded-full bg-[#1B3B2B] text-white font-bold text-xs hover:bg-[#26533d] transition-colors cursor-pointer"
              >
                Close & Continue
              </button>
            </div>
          ) : (
            <>
              {/* Agreed Amount Summary Card */}
              <div className="p-4 rounded-2xl bg-white border border-stone-200 space-y-2 shadow-xs">
                <div className="flex items-center justify-between text-stone-900 pb-2 border-b border-stone-100">
                  <span className="text-xs text-stone-500 font-semibold">Agreed Advance / Security Deposit</span>
                  <span className="font-extrabold text-base text-stone-900">₹{agreedAmount.toFixed(2)}</span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-stone-600 pt-1">
                  <span>Product:</span>
                  <span className="font-medium text-stone-800 truncate max-w-[200px]">{booking.listing.title}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-stone-600">
                  <span>Booking Reference:</span>
                  <span className="font-mono text-stone-700">CS-BKG-{booking.id}</span>
                </div>
              </div>

              {/* Status Banner */}
              {isConfirmed ? (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
                  <div className="flex items-center space-x-2 font-bold text-xs text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Advance payment confirmed by both parties.</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 pl-6">
                    Direct payment of ₹{depositPayment?.amount} ({depositPayment?.payment_method_display || depositPayment?.payment_method}) was declared by the borrower and receipt confirmed by the lender.
                  </p>
                </div>
              ) : isDeclared ? (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                  <div className="flex items-center space-x-2 font-bold text-xs text-amber-800">
                    <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Awaiting Lender Confirmation</span>
                  </div>
                  <p className="text-[11px] text-amber-700 pl-6">
                    Borrower marked ₹{depositPayment?.amount} as paid via {depositPayment?.payment_method_display || depositPayment?.payment_method}. Lender must confirm receipt.
                  </p>
                </div>
              ) : isDisputed ? (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
                  <div className="flex items-center space-x-2 font-bold text-xs text-rose-800">
                    <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                    <span>Payment Declaration Challenged</span>
                  </div>
                  <p className="text-[11px] text-rose-700 pl-6">
                    Lender disputed this payment: {depositPayment?.dispute_reason || 'Discrepancy reported'}.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-stone-700 space-y-1">
                  <div className="flex items-center space-x-2 font-bold text-xs text-stone-800">
                    <Clock className="w-4 h-4 text-stone-500 shrink-0" />
                    <span>Advance Payment Pending</span>
                  </div>
                  <p className="text-[11px] text-stone-500 pl-6">
                    Borrower should mark the advance as paid once direct transfer is completed.
                  </p>
                </div>
              )}

              {/* BORROWER VIEW: Mark as Paid */}
              {!isLender && !isConfirmed && (
                <div className="p-4 rounded-2xl bg-white border border-stone-200 space-y-3">
                  <div className="text-xs font-bold text-stone-900 flex items-center space-x-1.5">
                    <Send className="w-4 h-4 text-emerald-800" />
                    <span>Have you paid the agreed advance amount to the lender?</span>
                  </div>
                  <p className="text-[11px] text-stone-500 leading-relaxed">
                    Transfer ₹{agreedAmount.toFixed(2)} directly to the lender (via UPI or cash) and declare below.
                  </p>

                  <form onSubmit={handleMarkAsPaid} className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                          Payment Method
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value as any)}
                          className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs text-stone-900 outline-none focus:border-[#1B3B2B]"
                        >
                          <option value="upi">UPI (GPay, PhonePe, Paytm)</option>
                          <option value="cash">Cash in Person</option>
                          <option value="bank_transfer">Bank Transfer / IMPS</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                          Ref / UTR Number (Optional)
                        </label>
                        <input
                          type="text"
                          value={txRef}
                          onChange={(e) => setTxRef(e.target.value)}
                          placeholder="e.g. UPI Ref ID"
                          className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs text-stone-900 outline-none focus:border-[#1B3B2B]"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-800 text-white font-bold text-xs hover:bg-emerald-900 transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Recording Declaration...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Mark as Paid</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* LENDER VIEW: Confirm Received or Dispute */}
              {isLender && !isConfirmed && (
                <div className="p-4 rounded-2xl bg-white border border-stone-200 space-y-3">
                  <div className="text-xs font-bold text-stone-900 flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-800" />
                    <span>Have you received the agreed advance amount from the borrower?</span>
                  </div>

                  {depositPayment ? (
                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-100 space-y-1 text-[11px] text-stone-600">
                      <div><span className="font-semibold text-stone-800">Declared Amount:</span> ₹{depositPayment.amount}</div>
                      <div><span className="font-semibold text-stone-800">Method:</span> {depositPayment.payment_method_display || depositPayment.payment_method}</div>
                      {depositPayment.transaction_reference && (
                        <div><span className="font-semibold text-stone-800">Reference:</span> {depositPayment.transaction_reference}</div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-stone-500">
                      Borrower has not yet submitted a declaration. You can still confirm receipt once you receive the funds.
                    </p>
                  )}

                  {showDisputeInput ? (
                    <div className="space-y-2 pt-1">
                      <label className="block text-[11px] font-semibold text-stone-700">
                        Reason for Challenge:
                      </label>
                      <input
                        type="text"
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        placeholder="e.g. Amount not reflected in bank account"
                        className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs text-stone-900 outline-none focus:border-[#1B3B2B]"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleDispute}
                          disabled={isSubmitting}
                          className="flex-1 py-2 px-3 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 cursor-pointer disabled:opacity-50"
                        >
                          Confirm Challenge
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowDisputeInput(false)}
                          className="py-2 px-3 rounded-xl border border-stone-300 text-stone-600 text-xs hover:bg-stone-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={handleConfirmReceived}
                        disabled={isSubmitting}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-800 text-white font-bold text-xs hover:bg-emerald-900 transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Confirming...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Confirm Received</span>
                          </>
                        )}
                      </button>

                      {depositPayment && (
                        <button
                          type="button"
                          onClick={() => setShowDisputeInput(true)}
                          className="py-2.5 px-3 rounded-xl border border-stone-300 text-stone-600 text-xs hover:bg-stone-50 cursor-pointer"
                        >
                          Challenge
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Feedback Notifications */}
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

              {/* Disclaimer */}
              <p className="text-[10px] text-stone-400 text-center leading-relaxed">
                CampusShare records peer payment declarations and mutual confirmations. The platform does not process banking transactions or hold money in escrow.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
