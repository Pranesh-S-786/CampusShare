import { useState, useEffect, useCallback } from 'react'
import {
  X,
  Printer,
  ShieldCheck,
  AlertCircle,
  FileText,
  Loader2,
} from 'lucide-react'
import {
  type BookingSettlementBillResponse,
  getBookingSettlementBill,
} from '../../services/api'

interface SettlementBillModalProps {
  bookingId: number
  isOpen: boolean
  onClose: () => void
}

export function SettlementBillModal({
  bookingId,
  isOpen,
  onClose,
}: SettlementBillModalProps) {
  const [data, setData] = useState<BookingSettlementBillResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadBill = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await getBookingSettlementBill(bookingId)
      setData(res)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate settlement bill.')
    } finally {
      setIsLoading(false)
    }
  }, [bookingId])

  useEffect(() => {
    if (isOpen) {
      loadBill()
    }
  }, [isOpen, loadBill])

  if (!isOpen) return null

  const handlePrint = () => {
    window.print()
  }

  const s = data?.financial_summary
  const b = data?.booking

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 print:p-0 print:bg-white print:static">
      <div className="bg-[#FBF8F3] rounded-t-3xl sm:rounded-3xl max-w-3xl w-full border border-stone-200/80 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[90vh] print:max-h-none print:border-none print:shadow-none print:rounded-none">
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto my-2 sm:hidden shrink-0 print:hidden" />

        {/* Modal Header (Hidden on print) */}
        <div className="p-3.5 sm:p-5 bg-white border-b border-stone-200/80 flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#1B3B2B] flex items-center justify-center border border-emerald-100">
              <FileText className="w-5 h-5 text-emerald-800" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-sm sm:text-base">
                Itemized Settlement Bill
              </h3>
              <p className="text-xs text-stone-500 font-mono">
                {s?.invoice_number || `CS-BILL-${bookingId}`}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isLoading || !data}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#1B3B2B] hover:bg-[#25503B] text-white flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
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

        {/* Modal Body / Printable Invoice */}
        <div className="p-5 sm:p-8 overflow-y-auto flex-1 space-y-6 text-stone-800 print:overflow-visible print:p-4">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#1B3B2B] animate-spin" />
              <p className="text-xs font-medium text-stone-500">
                Compiling direct payment declarations and settlement record...
              </p>
            </div>
          ) : error ? (
            <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <div className="flex items-center space-x-2 font-bold mb-1">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Unable to load settlement document</span>
              </div>
              <p>{error}</p>
            </div>
          ) : data && s && b ? (
            <div className="space-y-6">
              {/* Document Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-stone-200">
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-extrabold text-xl text-[#1B3B2B] tracking-tight">
                      CampusShare
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-200 text-stone-700 font-mono uppercase">
                      Direct Peer Transaction Record
                    </span>
                  </div>
                  <p className="text-xs text-stone-500">
                    Transparent Campus Rental & Borrowing Agreement
                  </p>
                  <p className="text-[11px] text-stone-400 font-mono mt-1">
                    Issue Date: {new Date(data.generated_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="text-left sm:text-right font-mono text-xs">
                  <span className="text-[10px] text-stone-400 uppercase tracking-wider block">
                    Document Ref
                  </span>
                  <span className="font-bold text-stone-800 text-sm">
                    {data.bill_number}
                  </span>
                  <div className="mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                      Settlement: {s.settlement_status.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Parties Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-white border border-stone-200/80 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-mono text-stone-400 font-bold block mb-1">
                    Item Lender (Owner)
                  </span>
                  <p className="font-bold text-stone-900 text-sm">
                    {b.lender.full_name || b.lender.username}
                  </p>
                  <p className="text-stone-500">{b.lender.college_name}</p>
                  {b.lender.college_email && (
                    <p className="text-stone-400 font-mono text-[11px]">{b.lender.college_email}</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] uppercase font-mono text-stone-400 font-bold block mb-1">
                    Borrower (Renter)
                  </span>
                  <p className="font-bold text-stone-900 text-sm">
                    {b.borrower.full_name || b.borrower.username}
                  </p>
                  <p className="text-stone-500">{b.borrower.college_name}</p>
                  {b.borrower.college_email && (
                    <p className="text-stone-400 font-mono text-[11px]">{b.borrower.college_email}</p>
                  )}
                </div>
              </div>

              {/* Item & Period Details */}
              <div className="p-4 rounded-2xl bg-white border border-stone-200/80 space-y-2 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-stone-100 gap-1">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-stone-400 font-bold block">
                      Marketplace Item
                    </span>
                    <span className="font-bold text-stone-900 text-sm">{b.listing.title}</span>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] uppercase font-mono text-stone-400 font-bold block">
                      Agreed Duration
                    </span>
                    <span className="font-semibold text-stone-700">
                      {s.start_date} → {s.end_date} ({s.duration_days} day{s.duration_days === 1 ? '' : 's'})
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                  <div>
                    <span className="text-stone-400 block font-mono">Agreed Rate</span>
                    <span className="font-bold text-stone-800">
                      ₹{s.rental_rate} / {s.pricing_unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block font-mono">Pickup Confirmed</span>
                    <span className="font-medium text-stone-700">
                      {b.pickup_confirmed_at ? new Date(b.pickup_confirmed_at).toLocaleDateString() : 'Pending'}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block font-mono">Return Confirmed</span>
                    <span className="font-medium text-stone-700">
                      {b.return_confirmed_at ? new Date(b.return_confirmed_at).toLocaleDateString() : 'Pending'}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block font-mono">Currency</span>
                    <span className="font-bold text-stone-800">{s.currency}</span>
                  </div>
                </div>
              </div>

              {/* Financial Terms Breakdown Table */}
              <div className="overflow-x-auto rounded-2xl border border-stone-200/80 bg-white touch-pan-x touch-scroll">
                <table className="min-w-[500px] w-full text-xs text-left">
                  <thead className="bg-stone-50 border-b border-stone-200/80 text-[10px] uppercase font-mono text-stone-500">
                    <tr>
                      <th className="py-2.5 px-4 font-bold">Itemized Financial Component</th>
                      <th className="py-2.5 px-4 text-right font-bold">Agreed Terms</th>
                      <th className="py-2.5 px-4 text-right font-bold">Declared Paid</th>
                      <th className="py-2.5 px-4 text-right font-bold">Confirmed Received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-medium">
                    <tr>
                      <td className="py-3 px-4">
                        <div className="font-bold text-stone-900">Base Rental Charge</div>
                        <div className="text-[11px] text-stone-500">
                          {s.duration_days} day{s.duration_days === 1 ? '' : 's'} at agreed rate
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-stone-900">₹{s.agreed_base_rent}</td>
                      <td className="py-3 px-4 text-right text-stone-700 font-mono">₹{s.rent_declared}</td>
                      <td className="py-3 px-4 text-right text-emerald-800 font-mono font-bold">₹{s.rent_confirmed}</td>
                    </tr>

                    <tr>
                      <td className="py-3 px-4">
                        <div className="font-bold text-stone-900">Refundable Security Deposit</div>
                        <div className="text-[11px] text-stone-500">Held by lender during rental; refundable upon return</div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-stone-900">₹{s.agreed_deposit}</td>
                      <td className="py-3 px-4 text-right text-stone-700 font-mono">₹{s.deposit_declared}</td>
                      <td className="py-3 px-4 text-right text-emerald-800 font-mono font-bold">₹{s.deposit_confirmed}</td>
                    </tr>

                    {Number(s.approved_deductions) > 0 && (
                      <tr className="bg-amber-50/40">
                        <td className="py-3 px-4">
                          <div className="font-bold text-amber-950">Approved Deductions / Late Fees</div>
                          <div className="text-[11px] text-amber-800">Mutually accepted adjustments</div>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-amber-900">-₹{s.approved_deductions}</td>
                        <td className="py-3 px-4 text-right text-stone-500 font-mono">—</td>
                        <td className="py-3 px-4 text-right text-amber-900 font-mono font-bold">-₹{s.approved_deductions}</td>
                      </tr>
                    )}

                    {Number(s.disputed_adjustments) > 0 && (
                      <tr className="bg-rose-50/40">
                        <td className="py-3 px-4">
                          <div className="font-bold text-rose-950">Disputed Adjustments (Unresolved)</div>
                          <div className="text-[11px] text-rose-700">Preserved in dispute status; not finalized</div>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-rose-900">₹{s.disputed_adjustments}</td>
                        <td className="py-3 px-4 text-right text-rose-700 font-mono">Disputed</td>
                        <td className="py-3 px-4 text-right text-rose-700 font-mono">Unresolved</td>
                      </tr>
                    )}

                    <tr className="bg-stone-50/80 font-bold text-xs">
                      <td className="py-3 px-4 text-stone-900 uppercase font-mono tracking-wider">
                        Total Upfront Due Before Handover
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-[#1B3B2B] text-sm">
                        ₹{s.total_due_upfront}
                      </td>
                      <td className="py-3 px-4 text-right text-stone-800 font-mono">
                        ₹{s.total_declared_paid}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-900 font-mono text-sm">
                        ₹{s.total_confirmed_received}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Deposit Reconciliation Section */}
              {Number(s.agreed_deposit) > 0 && (
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 text-xs space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
                    <span className="font-bold text-emerald-950 uppercase tracking-wide font-mono text-[10px]">
                      Deposit Refund Settlement Status
                    </span>
                    <span className="font-mono text-[11px] font-bold text-emerald-900">
                      Refund Status: {s.refund_status.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div>
                      <span className="text-emerald-800 text-[10px] block font-mono">Original Deposit</span>
                      <span className="font-bold text-stone-800">₹{s.agreed_deposit}</span>
                    </div>
                    <div>
                      <span className="text-emerald-800 text-[10px] block font-mono">Approved Deductions</span>
                      <span className="font-bold text-amber-900">-₹{s.approved_deductions}</span>
                    </div>
                    <div>
                      <span className="text-emerald-800 text-[10px] block font-mono">Net Refund Due</span>
                      <span className="font-extrabold text-[#1B3B2B]">₹{s.net_refundable_deposit}</span>
                    </div>
                    <div>
                      <span className="text-emerald-800 text-[10px] block font-mono">Refund Confirmed</span>
                      <span className="font-extrabold text-emerald-800 font-mono">
                        ₹{s.refund_confirmed_amount}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Payments & Declaration Audit Log */}
              {data.payments.length > 0 && (
                <div className="p-4 rounded-2xl bg-white border border-stone-200/80 space-y-2.5 text-xs">
                  <span className="font-bold text-stone-900 uppercase tracking-wide font-mono text-[10px] block">
                    Recorded Direct Payment Declarations & Confirmations
                  </span>
                  <div className="space-y-1.5 font-mono text-[11px]">
                    {data.payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-stone-50 border border-stone-100"
                      >
                        <div className="flex items-center space-x-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              p.status === 'confirmed'
                                ? 'bg-emerald-500'
                                : p.status === 'disputed'
                                ? 'bg-rose-500'
                                : 'bg-amber-500'
                            }`}
                          />
                          <span className="font-bold text-stone-800">₹{p.amount}</span>
                          <span className="text-stone-500 capitalize">({p.purpose})</span>
                          <span className="text-stone-400">via {p.payment_method_display}</span>
                        </div>
                        <div className="text-right">
                          <span
                            className={`font-semibold ${
                              p.status === 'confirmed'
                                ? 'text-emerald-800'
                                : p.status === 'disputed'
                                ? 'text-rose-700'
                                : 'text-amber-800'
                            }`}
                          >
                            {p.status_display}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Legal Disclaimer Box (Strict Architecture Policy) */}
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 text-amber-950 text-xs space-y-1.5">
                <div className="flex items-center space-x-1.5 font-bold text-amber-900 text-xs">
                  <ShieldCheck className="w-4 h-4 text-amber-800 shrink-0" />
                  <span>Platform Declaration & Legal Clarification</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900/90">
                  {data.disclaimer}
                </p>
                <p className="text-[10px] text-amber-800/80 font-mono pt-1">
                  This document records mutually declared peer actions and is not a tax invoice, bank-verified settlement receipt, or financial guarantee by CampusShare.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
