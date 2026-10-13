import { useState, useRef, useEffect } from 'react'
import {
  Search,
  ChevronDown,
  GraduationCap,
  ShieldCheck,
  Leaf,
} from 'lucide-react'
import bannerImg from '../../assets/marketplace_banner_cit.jpg'
import { type MarketplaceCategory } from '../../services/api'

interface MarketplaceHeroBannerProps {
  categories: MarketplaceCategory[]
  selectedCategorySlug: string
  onSelectCategory: (slug: string) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  onSearchSubmit: () => void
}

export function MarketplaceHeroBanner({
  categories,
  selectedCategorySlug,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
}: MarketplaceHeroBannerProps) {
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedCategoryObj = categories.find((c) => c.slug === selectedCategorySlug)
  const categoryLabel = selectedCategoryObj ? selectedCategoryObj.name : 'All categories'

  return (
    <div
      className="relative rounded-3xl overflow-hidden shadow-sm border border-stone-200/80 min-h-[240px] sm:min-h-[340px] lg:min-h-[370px] flex flex-col justify-between p-4 sm:p-8 lg:p-10"
      style={{
        backgroundImage: `linear-gradient(to right, rgba(251, 248, 243, 0.98) 0%, rgba(251, 248, 243, 0.92) 50%, rgba(251, 248, 243, 0.45) 85%, rgba(251, 248, 243, 0.2) 100%), url(${bannerImg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center right',
      }}
    >
      {/* Top/Middle Area: Left Headline & Right Feature Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Eyebrow, Main Headline & Subtitle matching reference */}
        <div className="lg:col-span-8 space-y-2.5 sm:space-y-4 max-w-xl">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.25em] text-stone-500 font-mono">
            CampusShare
          </span>

          <h1 className="text-2xl sm:text-4xl lg:text-[44px] font-extrabold tracking-tight text-stone-900 leading-[1.08]">
            Borrow.
            <br />
            Lend. <span className="text-[#2C6E49]">Share.</span>
          </h1>

          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-md">
            Textbooks, gadgets, lab equipment, sports gear and more from students around your campus.
          </p>
        </div>

        {/* Right: Floating Value Prop Card matching reference */}
        <div className="hidden sm:block lg:col-span-4 lg:justify-self-end">
          <div className="rounded-2xl bg-white/90 backdrop-blur-md border border-stone-200/80 shadow-md p-4 space-y-3.5 max-w-[260px]">
            <div className="flex items-center space-x-3 text-stone-800">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div className="leading-tight">
                <span className="text-xs font-bold block text-stone-900">Verified community</span>
                <span className="text-[10px] text-stone-500">(when available)</span>
              </div>
            </div>

            <div className="flex items-center space-x-3 text-stone-800">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="leading-tight">
                <span className="text-xs font-bold block text-stone-900">Safe and trusted</span>
                <span className="text-[10px] text-stone-500">student-to-student</span>
              </div>
            </div>

            <div className="flex items-center space-x-3 text-stone-800">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
                <Leaf className="w-4 h-4" />
              </div>
              <div className="leading-tight">
                <span className="text-xs font-bold block text-stone-900">More reuse</span>
                <span className="text-[10px] text-stone-500">A greener campus</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Embedded Search & Category Bar matching reference */}
      <div className="mt-4 sm:mt-6 max-w-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSearchSubmit()
          }}
          className="flex items-center bg-white rounded-full border border-stone-200 shadow-md p-1 sm:p-1.5 focus-within:ring-3 focus-within:ring-[#1B3B2B]/10 transition-all"
        >
          <div className="flex items-center pl-2.5 sm:pl-3 flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400 shrink-0 mr-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search items, e.g. calculator, camera..."
              className="w-full text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 bg-transparent outline-none"
            />
          </div>

          <div className="h-4 sm:h-5 w-px bg-stone-200 mx-1 sm:mx-2 shrink-0" />

          {/* Embedded Category Dropdown */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
              className="flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
            >
              <span className="max-w-[70px] sm:max-w-[120px] truncate">{categoryLabel}</span>
              <ChevronDown className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-stone-400 transition-transform ${categoryDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {categoryDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white border border-stone-200 shadow-xl p-1.5 z-50 animate-in fade-in-50 zoom-in-95">
                <button
                  type="button"
                  onClick={() => {
                    onSelectCategory('all')
                    setCategoryDropdownOpen(false)
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    selectedCategorySlug === 'all'
                      ? 'bg-emerald-50 text-emerald-900 font-bold'
                      : 'text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  All categories
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      onSelectCategory(cat.slug)
                      setCategoryDropdownOpen(false)
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      selectedCategorySlug === cat.slug
                        ? 'bg-emerald-50 text-emerald-900 font-bold'
                        : 'text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
