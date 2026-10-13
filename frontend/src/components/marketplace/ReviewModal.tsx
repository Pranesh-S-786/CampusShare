import { useState } from 'react'
import {
  X,
  Star,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Package,
  UserCheck,
} from 'lucide-react'
import {
  type Booking,
  submitBookingReview,
} from '../../services/api'

interface ReviewModalProps {
  booking: Booking | null
  isOpen: boolean
  onClose: () => void
  onReviewSubmitted?: () => void
}

export function ReviewModal({
  booking,
  isOpen,
  onClose,
  onReviewSubmitted,
}: ReviewModalProps) {
  const [activeTab, setActiveTab] = useState<'product' | 'lender'>('product')
  const [productRating, setProductRating] = useState<number>(5)
  const [productComment, setProductComment] = useState('')
  const [lenderRating, setLenderRating] = useState<number>(5)
  const [lenderComment, setLenderComment] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [productSuccess, setProductSuccess] = useState(false)
  const [lenderSuccess, setLenderSuccess] = useState(false)

  if (!isOpen || !booking) return null

  const handleSubmitProductReview = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    try {
      await submitBookingReview(booking.id, {
        review_type: 'product',
        rating: productRating,
        comment: productComment,
      })
      setProductSuccess(true)
      onReviewSubmitted?.()
      // Switch to lender tab if not submitted yet
      if (!lenderSuccess) {
        setActiveTab('lender')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit product review.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitLenderReview = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    try {
      await submitBookingReview(booking.id, {
        review_type: 'lender',
        rating: lenderRating,
        comment: lenderComment,
      })
      setLenderSuccess(true)
      onReviewSubmitted?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit lender review.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-[#FBF8F3] border border-stone-200 shadow-2xl overflow-hidden animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200/80 bg-white">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-100">
              <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-sm sm:text-base">
                Ratings & Reviews
              </h3>
              <p className="text-xs text-stone-500 font-mono truncate max-w-[260px]">
                {booking.listing.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle (Product vs Lender) */}
        <div className="flex border-b border-stone-200/80 bg-stone-50 px-6 pt-3">
          <button
            type="button"
            onClick={() => setActiveTab('product')}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'product'
                ? 'border-[#1B3B2B] text-[#1B3B2B]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Product Review</span>
            {productSuccess && <CheckCircle2 className="w-3 h-3 text-emerald-600 ml-1" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('lender')}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'lender'
                ? 'border-[#1B3B2B] text-[#1B3B2B]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Lender Review</span>
            {lenderSuccess && <CheckCircle2 className="w-3 h-3 text-emerald-600 ml-1" />}
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: PRODUCT REVIEW */}
          {activeTab === 'product' && (
            <div className="space-y-4">
              {productSuccess ? (
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <h5 className="font-bold text-sm">Product Review Submitted!</h5>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    Thank you! Your feedback helps campus students choose reliable gear.
                  </p>
                  {!lenderSuccess && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('lender')}
                      className="mt-2 px-4 py-2 rounded-full text-xs font-bold bg-[#1B3B2B] text-white hover:bg-[#25503B] transition-colors cursor-pointer"
                    >
                      Rate Lender Next
                    </button>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmitProductReview} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1.5">
                      Rate the Item (1–5 Stars)
                    </label>
                    <div className="flex items-center space-x-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setProductRating(star)}
                          className="p-1 text-stone-300 hover:text-amber-400 transition-colors cursor-pointer"
                        >
                          <Star
                            className={`w-7 h-7 ${
                              star <= productRating
                                ? 'fill-amber-400 text-amber-500'
                                : 'text-stone-300'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-xs font-bold text-stone-700 ml-2">
                        {productRating} of 5 Stars
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      Product Condition & Performance
                    </label>
                    <textarea
                      rows={3}
                      value={productComment}
                      onChange={(e) => setProductComment(e.target.value)}
                      placeholder="How was the item's condition, performance, and accuracy to the listing?"
                      className="w-full p-3 text-xs rounded-xl border border-stone-200 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1B3B2B]/20"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 rounded-full text-xs font-semibold text-stone-600 hover:bg-stone-200/60 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-xs cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                    >
                      {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Submit Product Review</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: LENDER REVIEW */}
          {activeTab === 'lender' && (
            <div className="space-y-4">
              {lenderSuccess ? (
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <h5 className="font-bold text-sm">Lender Review Submitted!</h5>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    Thank you! Your feedback contributes directly to campus trust and transparent peer ratings.
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-2 px-4 py-2 rounded-full text-xs font-bold bg-[#1B3B2B] text-white hover:bg-[#25503B] transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitLenderReview} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1.5">
                      Rate Lender: {booking.lender.full_name} (1–5 Stars)
                    </label>
                    <div className="flex items-center space-x-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setLenderRating(star)}
                          className="p-1 text-stone-300 hover:text-amber-400 transition-colors cursor-pointer"
                        >
                          <Star
                            className={`w-7 h-7 ${
                              star <= lenderRating
                                ? 'fill-amber-400 text-amber-500'
                                : 'text-stone-300'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-xs font-bold text-stone-700 ml-2">
                        {lenderRating} of 5 Stars
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      Punctuality, Communication & Handover Experience
                    </label>
                    <textarea
                      rows={3}
                      value={lenderComment}
                      onChange={(e) => setLenderComment(e.target.value)}
                      placeholder="Was the lender on time, responsive to messages, and polite during handover?"
                      className="w-full p-3 text-xs rounded-xl border border-stone-200 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1B3B2B]/20"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 rounded-full text-xs font-semibold text-stone-600 hover:bg-stone-200/60 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-xs cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                    >
                      {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Submit Lender Review</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
