import {
  Heart,
  CheckCircle2,
  PackageOpen,
  Plus,
  RefreshCw,
  AlertCircle,
  LayoutGrid,
  BookOpen,
  Laptop,
  FlaskConical,
  Trophy,
  Armchair,
  Headphones,
  Shirt,
  MoreHorizontal,
  ArrowRight,
  Star,
  Clock,
  Shield,
} from 'lucide-react'
import {
  type MarketplaceListing,
  type MarketplaceCategory,
} from '../../services/api'

interface MarketplaceProductGridProps {
  categories: MarketplaceCategory[]
  selectedCategorySlug: string
  onSelectCategory: (slug: string) => void
  listings: MarketplaceListing[]
  isLoading: boolean
  error: string | null
  onRetry: () => void
  onSelectListing: (listing: MarketplaceListing) => void
  onOpenPostItem: () => void
  onClearFilters: () => void
  collegeSubtext: string
  wishlistIds: number[]
  onToggleWishlist: (listingId: number) => void
}

export function MarketplaceProductGrid({
  categories,
  selectedCategorySlug,
  onSelectCategory,
  listings,
  isLoading,
  error,
  onRetry,
  onSelectListing,
  onOpenPostItem,
  onClearFilters,
  collegeSubtext,
  wishlistIds,
  onToggleWishlist,
}: MarketplaceProductGridProps) {
  // Category icon mapping
  const getCategoryIcon = (slug: string) => {
    switch (slug) {
      case 'books':
        return BookOpen
      case 'electronics':
        return Laptop
      case 'lab-equipment':
        return FlaskConical
      case 'sports':
        return Trophy
      case 'furniture':
        return Armchair
      case 'accessories':
        return Headphones
      case 'clothing':
        return Shirt
      default:
        return LayoutGrid
    }
  }

  return (
    <section className="space-y-6">
      {/* 1. Category Filter Strip matching reference image */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
        {/* 'All' button */}
        <button
          type="button"
          onClick={() => onSelectCategory('all')}
          className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center space-x-2 shrink-0 transition-all cursor-pointer ${
            selectedCategorySlug === 'all'
              ? 'bg-[#1B3B2B] text-white shadow-xs'
              : 'bg-white text-stone-700 hover:bg-stone-50 border border-stone-200/80 shadow-2xs'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>All</span>
        </button>

        {/* Dynamic Category Buttons from API */}
        {categories.map((cat) => {
          const Icon = getCategoryIcon(cat.slug)
          const isSelected = selectedCategorySlug === cat.slug
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.slug)}
              className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center space-x-2 shrink-0 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#1B3B2B] text-white shadow-xs'
                  : 'bg-white text-stone-700 hover:bg-stone-50 border border-stone-200/80 shadow-2xs'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.name}</span>
            </button>
          )
        })}

        {/* Ellipsis more button */}
        <button
          type="button"
          onClick={() => onSelectCategory('all')}
          className="p-2 rounded-full bg-white text-stone-500 hover:text-stone-800 border border-stone-200/80 shrink-0 shadow-2xs"
          title="Show all categories"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Section Heading matching reference */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-stone-900">
            Popular near you
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {collegeSubtext}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onSelectCategory('all')}
          className="text-xs font-semibold text-emerald-800 hover:underline flex items-center cursor-pointer"
        >
          <span>View all</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </button>
      </div>

      {/* 3. Product Grid & States */}
      {isLoading ? (
        /* Loading Skeleton */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl bg-white border border-stone-200/70 p-3.5 space-y-3 animate-pulse"
            >
              <div className="w-full aspect-[4/3] rounded-xl bg-stone-100" />
              <div className="h-4 bg-stone-100 rounded w-3/4" />
              <div className="h-3 bg-stone-100 rounded w-1/2" />
              <div className="h-4 bg-stone-100 rounded w-1/3" />
              <div className="flex items-center space-x-2 pt-1 border-t border-stone-50">
                <div className="w-6 h-6 rounded-full bg-stone-100" />
                <div className="h-3 bg-stone-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        /* Error State with Retry */
        <div className="rounded-2xl bg-rose-50 border border-rose-200/80 p-8 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
          <h4 className="text-sm font-bold text-rose-900">Failed to Load Campus Listings</h4>
          <p className="text-xs text-rose-700 max-w-md mx-auto">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 rounded-full text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-all inline-flex items-center space-x-2 cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      ) : listings.length === 0 ? (
        /* Clean Empty State (Strictly no fabricated demo products) */
        <div className="rounded-3xl bg-white border border-dashed border-stone-300/80 p-10 sm:p-14 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto shadow-xs border border-emerald-100/80">
            <PackageOpen className="w-7 h-7" />
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base font-bold text-stone-900">
              No Listings Found on Campus
            </h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              There are currently no items listed for the selected college or category filters.
              Be the first student to share gear, textbooks, or equipment with your peers!
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onOpenPostItem}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-md shadow-emerald-950/15 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Post the First Item</span>
            </button>

            <button
              type="button"
              onClick={onClearFilters}
              className="px-4 py-2.5 rounded-full text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-all cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        </div>
      ) : (
        /* Responsive Product Grid with Real Data */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {listings.map((item) => {
            const isWishlisted = wishlistIds.includes(item.id)
            const lenderInitial = item.lender?.full_name?.charAt(0).toUpperCase() || 'S'

            return (
              <div
                key={item.id}
                onClick={() => onSelectListing(item)}
                className="group rounded-2xl bg-white border border-stone-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col justify-between"
              >
                {/* Image & Wishlist Pill */}
                <div className="relative aspect-[4/3] bg-stone-100 overflow-hidden">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 bg-stone-50">
                      <LayoutGrid className="w-8 h-8 stroke-[1.5] text-stone-300 mb-1" />
                      <span className="text-[10px] font-mono text-stone-400">CampusShare Gear</span>
                    </div>
                  )}

                  {/* Wishlist Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleWishlist(item.id)
                    }}
                    className={`absolute top-2.5 right-2.5 p-1.5 rounded-full backdrop-blur-md transition-all cursor-pointer ${
                      isWishlisted
                        ? 'bg-rose-50 text-rose-600 shadow-xs'
                        : 'bg-white/80 hover:bg-white text-stone-600 hover:text-rose-500 shadow-2xs'
                    }`}
                    title={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
                  </button>

                  {/* Availability Badge */}
                  <div className="absolute top-2.5 left-2.5 flex items-center space-x-1.5 flex-wrap gap-y-1">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-black/75 text-white backdrop-blur-xs">
                      {item.listing_type || 'rent'}
                    </span>
                    {item.availability_status === 'return_overdue' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-600 text-white shadow-2xs backdrop-blur-xs">
                        <Clock className="w-2.5 h-2.5 mr-0.5 animate-pulse" />
                        Return Overdue
                      </span>
                    ) : item.availability_status === 'currently_booked' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-600 text-white shadow-2xs backdrop-blur-xs">
                        <Clock className="w-2.5 h-2.5 mr-0.5" />
                        Booked {item.booked_until ? `until ${new Date(item.booked_until).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : ''}
                      </span>
                    ) : item.is_available ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-white/95 text-emerald-800 shadow-2xs backdrop-blur-xs">
                        <CheckCircle2 className="w-2.5 h-2.5 mr-0.5 text-emerald-600" />
                        Available
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-stone-700 text-stone-200 shadow-2xs backdrop-blur-xs">
                        Unavailable
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Body */}
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="text-xs sm:text-sm font-bold text-stone-900 group-hover:text-emerald-900 transition-colors line-clamp-1">
                        {item.title}
                      </h3>
                      {typeof item.review_count === 'number' && item.review_count > 0 && (
                        <div className="flex items-center space-x-0.5 shrink-0 text-amber-600 font-bold text-[11px]">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                          <span>{Number(item.average_rating || 5).toFixed(1)}</span>
                          <span className="text-[10px] text-stone-400 font-normal">({item.review_count})</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-500 mt-0.5 truncate">
                      {item.subcategory || item.category.name}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="flex items-baseline space-x-1">
                    {item.listing_type === 'lend' ? (
                      <span className="text-xs sm:text-sm font-bold text-emerald-800">
                        Free to Lend
                      </span>
                    ) : item.listing_type === 'sell' ? (
                      <>
                        <span className="text-sm sm:text-base font-extrabold text-[#1B3B2B]">
                          ₹{item.price}
                        </span>
                        <span className="text-[11px] font-medium text-stone-500">
                          • For Sale
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm sm:text-base font-extrabold text-[#1B3B2B]">
                          ₹{item.price}
                        </span>
                        <span className="text-[11px] font-medium text-stone-500">
                          / {item.pricing_unit}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Lender Footer */}
                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 min-w-0">
                      {item.lender.avatar_url ? (
                        <img
                          src={item.lender.avatar_url}
                          alt={item.lender.full_name}
                          className="w-5 h-5 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-[#1B3B2B] text-amber-100 flex items-center justify-center font-bold text-[10px] shrink-0">
                          {lenderInitial}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-stone-800 truncate block">
                          {item.lender.full_name || item.lender.username}
                        </span>
                        <span className="text-[10px] text-stone-400 truncate block">
                          {item.college?.short_code || item.lender.college_short_code || 'Campus'}
                          {item.lender.grad_year ? ` • ${item.lender.grad_year} Batch` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Lender Trust Score Pill */}
                    {item.lender.trust_score !== undefined && (
                      <div
                        className="flex items-center space-x-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200/80 text-[10px] font-semibold shrink-0"
                        title={`Lender Trust Score: ${item.lender.trust_score}/100`}
                      >
                        <Shield className="w-2.5 h-2.5 text-emerald-700" />
                        <span>{item.lender.trust_score}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
