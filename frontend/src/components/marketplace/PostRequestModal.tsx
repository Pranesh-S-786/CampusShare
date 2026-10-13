import { useState } from 'react'
import {
  X,
  FileText,
  Send,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import {
  type MarketplaceCategory,
  type College,
  type WantedItemRequest,
  createWantedRequest,
} from '../../services/api'
import { useAuth } from '../../context/AuthContext'

interface PostRequestModalProps {
  isOpen: boolean
  onClose: () => void
  categories: MarketplaceCategory[]
  colleges: College[]
  onRequestCreated?: (request: WantedItemRequest) => void
}

export function PostRequestModal({
  isOpen,
  onClose,
  categories,
  colleges,
  onRequestCreated,
}: PostRequestModalProps) {
  const { user, openAuthModal } = useAuth()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>(categories[0]?.id || '')
  const [requestType, setRequestType] = useState<'rent' | 'borrow' | 'buy'>('borrow')
  const [budget, setBudget] = useState('')
  const [preferredTerms, setPreferredTerms] = useState('')
  const [neededDate, setNeededDate] = useState('')
  const [notes, setNotes] = useState('')
  const [collegeId, setCollegeId] = useState<number | ''>(user?.college?.id || '')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      openAuthModal('login')
      return
    }

    if (!title.trim()) {
      setError('Please provide an item title for your request.')
      return
    }
    if (!categoryId) {
      setError('Please select a category.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const created = await createWantedRequest({
        title: title.trim(),
        description: description.trim() || undefined,
        category_id: Number(categoryId),
        request_type: requestType,
        budget: budget.trim() || undefined,
        preferred_terms: preferredTerms.trim() || undefined,
        needed_date: neededDate || undefined,
        college_id: collegeId ? Number(collegeId) : undefined,
        notes: notes.trim() || undefined,
      })

      // Reset form
      setTitle('')
      setDescription('')
      setBudget('')
      setPreferredTerms('')
      setNeededDate('')
      setNotes('')

      if (onRequestCreated) {
        onRequestCreated(created)
      }
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to publish request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white border border-stone-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 max-h-[94vh] sm:max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-100 bg-[#FBF8F3]">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-900 flex items-center justify-center font-bold shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-800" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-stone-900 truncate">Post Wanted Request</h3>
              <p className="text-[11px] sm:text-xs text-stone-500 truncate">Ask campus peers for gear not currently listed</p>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-6 space-y-4 safe-area-pb">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              What are you looking for? <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Casio Scientific Calculator FX-991CW for semester exam"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3B2B]/20 focus:border-[#1B3B2B]"
            />
          </div>

          {/* Category & Request Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3B2B]/20 focus:border-[#1B3B2B]"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Intent Type
              </label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3B2B]/20 focus:border-[#1B3B2B]"
              >
                <option value="borrow">Free to Borrow</option>
                <option value="rent">Paid Rental</option>
                <option value="buy">Looking to Buy</option>
              </select>
            </div>
          </div>

          {/* Budget & Preferred Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Budget (₹) <span className="text-stone-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-stone-400">₹</span>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 100"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-stone-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3B2B]/20 focus:border-[#1B3B2B]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Needed Date
              </label>
              <input
                type="date"
                min={todayStr}
                value={neededDate}
                onChange={(e) => setNeededDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3B2B]/20 focus:border-[#1B3B2B]"
              />
            </div>
          </div>

          {/* Preferred Terms */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Preferred Terms <span className="text-stone-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Needed for 2 days, or full weekend"
              value={preferredTerms}
              onChange={(e) => setPreferredTerms(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3B2B]/20 focus:border-[#1B3B2B]"
            />
          </div>

          {/* College Visibility */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Campus Visibility
            </label>
            <select
              value={collegeId}
              onChange={(e) => setCollegeId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3B2B]/20 focus:border-[#1B3B2B]"
            >
              <option value="">All Partner Campuses</option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.short_code})
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Description & Specifics
            </label>
            <textarea
              rows={2}
              placeholder="Specify model numbers, condition requirements, or specific class subjects..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3B2B]/20 focus:border-[#1B3B2B] resize-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Handover Notes <span className="text-stone-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Can meet in main canteen or hostel gate after 5 PM"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3B2B]/20 focus:border-[#1B3B2B]"
            />
          </div>

          {/* Notice */}
          <div className="p-3 rounded-xl bg-[#FBF8F3] border border-stone-200 text-[11px] text-stone-600 leading-relaxed">
            Requests are broadcasted to verified students on your campus. When someone offers their item, you can review their offer and proceed to book or list directly.
          </div>

          {/* Submit */}
          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-full text-xs font-semibold text-stone-600 hover:bg-stone-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] disabled:opacity-50 shadow-sm transition-all flex items-center space-x-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Publish Request</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
