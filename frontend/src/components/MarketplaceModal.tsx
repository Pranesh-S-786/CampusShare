import { useState } from 'react'
import { Search, X, PackageOpen, ArrowLeft, Filter } from 'lucide-react'

interface MarketplaceModalProps {
  isOpen: boolean
  onClose: () => void
  initialCategory?: string
}

export function MarketplaceModal({ isOpen, onClose, initialCategory = 'All' }: MarketplaceModalProps) {
  const [selectedCategory, setSelectedCategory] = useState(initialCategory)
  const [searchQuery, setSearchQuery] = useState('')

  if (!isOpen) return null

  const categories = [
    'All',
    'Books',
    'Electronics',
    'Lab Equipment',
    'Sports',
    'Furniture',
    'Accessories',
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-stone-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-stone-50 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]">
        {/* Mobile Drag Indicator Pill */}
        <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="p-4 sm:p-6 bg-white border-b border-stone-200/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
              title="Return to landing page"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-stone-900">
                Campus Marketplace Catalog
              </h2>
              <p className="text-xs text-stone-500">
                Browse student gear, textbooks, lab equipment, and accessories
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar & Search */}
        <div className="p-5 bg-white/60 border-b border-stone-200/80 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by course, item, or category..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-white border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none pb-1 sm:pb-0">
            <Filter className="w-3.5 h-3.5 text-stone-400 mr-1 flex-shrink-0" />
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Genuine Empty State (Strict rule: No fake listings or demo items) */}
        <div className="flex-1 p-10 sm:p-16 flex flex-col items-center justify-center text-center overflow-y-auto">
          <div className="w-20 h-20 rounded-3xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-100/80 mb-5 shadow-xs">
            <PackageOpen className="w-10 h-10" />
          </div>

          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-stone-100 text-stone-700 border border-stone-200/70 mb-3">
            Category: {selectedCategory}
          </span>

          <h3 className="text-xl font-bold text-stone-900 mb-2">
            No Item Listings Available Yet
          </h3>
          <p className="text-sm text-stone-600 max-w-md leading-relaxed mb-6 font-normal">
            The marketplace framework is connected to your Supabase PostgreSQL database. Student item creation, lending records, and search will be activated in the next stage.
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 shadow-xs transition-colors cursor-pointer"
            >
              Back to Landing Page
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
