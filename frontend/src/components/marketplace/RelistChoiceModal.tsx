import { useState } from 'react'
import {
  X,
  RotateCcw,
  Edit3,
  Archive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Package,
} from 'lucide-react'
import {
  type Booking,
  type MarketplaceListing,
  submitRelistChoice,
} from '../../services/api'

interface RelistChoiceModalProps {
  booking: Booking | null
  isOpen: boolean
  onClose: () => void
  onRelisted?: (listing: MarketplaceListing) => void
  onOpenEditListing?: (listing: MarketplaceListing) => void
}

export function RelistChoiceModal({
  booking,
  isOpen,
  onClose,
  onRelisted,
  onOpenEditListing,
}: RelistChoiceModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  if (!isOpen || !booking) return null

  const handleChoice = async (choice: 'relist' | 'edit' | 'archive') => {
    setIsSubmitting(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const res = await submitRelistChoice(booking.id, { choice })
      setSuccessMessage(res.message)

      setTimeout(() => {
        onClose()
        if (choice === 'relist' && res.listing) {
          onRelisted?.(res.listing)
        } else if (choice === 'edit' && res.listing && onOpenEditListing) {
          onOpenEditListing(res.listing)
        }
      }, 1000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update re-listing choice.')
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
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-800" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-stone-900 text-xs sm:text-base">
                Physical Return Verified
              </h3>
              <p className="text-[11px] sm:text-xs text-stone-500 font-mono truncate max-w-[220px] sm:max-w-[260px]">
                {booking.listing.title}
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
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          <div className="text-center space-y-2">
            <h4 className="text-base sm:text-lg font-extrabold text-stone-900">
              Would you like to list this product again?
            </h4>
            <p className="text-xs text-stone-600 max-w-md mx-auto leading-relaxed">
              The item has been physically inspected and return is complete. Choose what you would like to do with this listing on the campus marketplace:
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Three Explicit Choices (Section 9) */}
          <div className="space-y-3 pt-1">
            {/* 1. Yes - Relist */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleChoice('relist')}
              className="w-full p-4 rounded-2xl bg-white border border-stone-200/90 hover:border-[#1B3B2B] shadow-2xs hover:shadow-md transition-all text-left flex items-start space-x-3.5 group cursor-pointer disabled:opacity-60"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-[#1B3B2B] group-hover:text-white transition-colors">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs sm:text-sm font-bold text-stone-900 block group-hover:text-emerald-900">
                  Yes, relist product immediately
                </span>
                <span className="text-[11px] text-stone-500 block mt-0.5">
                  Make the listing active again with existing terms, price, and photos. Listing history is preserved.
                </span>
              </div>
            </button>

            {/* 2. Yes, after editing */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleChoice('edit')}
              className="w-full p-4 rounded-2xl bg-white border border-stone-200/90 hover:border-amber-700 shadow-2xs hover:shadow-md transition-all text-left flex items-start space-x-3.5 group cursor-pointer disabled:opacity-60"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-amber-800 group-hover:text-white transition-colors">
                <Edit3 className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs sm:text-sm font-bold text-stone-900 block group-hover:text-amber-900">
                  Yes, after editing
                </span>
                <span className="text-[11px] text-stone-500 block mt-0.5">
                  Open the listing editor to update price, photos, or description before publishing back to campus.
                </span>
              </div>
            </button>

            {/* 3. No - Keep unlisted / archive */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleChoice('archive')}
              className="w-full p-4 rounded-2xl bg-white border border-stone-200/90 hover:border-stone-400 shadow-2xs hover:shadow-md transition-all text-left flex items-start space-x-3.5 group cursor-pointer disabled:opacity-60"
            >
              <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-600 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-stone-800 group-hover:text-white transition-colors">
                <Archive className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs sm:text-sm font-bold text-stone-900 block group-hover:text-stone-800">
                  No, do not list again
                </span>
                <span className="text-[11px] text-stone-500 block mt-0.5">
                  Keep this product archived. All rental, financial, and dispute records remain safely stored.
                </span>
              </div>
            </button>
          </div>

          {isSubmitting && (
            <div className="py-2 flex items-center justify-center space-x-2 text-xs text-stone-500">
              <Loader2 className="w-4 h-4 animate-spin text-[#1B3B2B]" />
              <span>Applying choice...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
