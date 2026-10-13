import { useState, useEffect } from 'react'
import {
  X,
  Heart,
  CheckCircle2,
  Building,
  ShieldCheck,
  MapPin,
  Sparkles,
  DollarSign,
  Edit3,
  MessageSquare,
} from 'lucide-react'
import { type MarketplaceListing } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

interface ProductDetailModalProps {
  listing: MarketplaceListing | null
  isOpen: boolean
  onClose: () => void
  isWishlisted: boolean
  onToggleWishlist: (listingId: number) => void
  onOpenEditListing?: (listing: MarketplaceListing) => void
  onRequestBooking?: (listing: MarketplaceListing) => void
  onMessageOwner?: (listing: MarketplaceListing) => void
}

export function ProductDetailModal({
  listing,
  isOpen,
  onClose,
  isWishlisted,
  onToggleWishlist,
  onOpenEditListing,
  onRequestBooking,
  onMessageOwner,
}: ProductDetailModalProps) {
  const { user, openAuthModal } = useAuth()
  const [activePhotoUrl, setActivePhotoUrl] = useState<string>('')

  useEffect(() => {
    if (listing) {
      if (listing.images && listing.images.length > 0) {
        setActivePhotoUrl(listing.images[0].image_url)
      } else {
        setActivePhotoUrl(listing.image_url || '')
      }
    }
  }, [listing])

  if (!isOpen || !listing) return null

  const lenderInitial = listing.lender?.full_name?.charAt(0).toUpperCase() || 'S'
  const isOwner = user && listing.lender && user.id === listing.lender.id

  const allPhotos: string[] = []
  if (listing.images && listing.images.length > 0) {
    listing.images.forEach((img) => {
      if (img.image_url && !allPhotos.includes(img.image_url)) {
        allPhotos.push(img.image_url)
      }
    })
  } else if (listing.image_url) {
    allPhotos.push(listing.image_url)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl bg-white border border-stone-200 shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-[#FBF8F3]">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 font-mono">
              {listing.category.name}
            </span>
            <span className="text-stone-300">•</span>
            <span className="text-xs text-stone-500 font-medium">
              {listing.subcategory || 'Campus Item'}
            </span>
            <span className="text-stone-300">•</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900">
              {listing.listing_type}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {isOwner && onOpenEditListing && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenEditListing(listing)
                }}
                className="px-3 py-1.5 rounded-full text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onToggleWishlist(listing.id)}
              className={`p-2 rounded-full border border-stone-200 transition-colors cursor-pointer ${
                isWishlisted
                  ? 'bg-rose-50 text-rose-600 border-rose-200'
                  : 'bg-white hover:bg-stone-100 text-stone-600'
              }`}
              title={isWishlisted ? 'Saved to wishlist' : 'Save to wishlist'}
            >
              <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 space-y-6">
          {/* Main Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
            {/* Image Box & Thumbnails */}
            <div className="space-y-3">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 shadow-2xs">
                {activePhotoUrl ? (
                  <img
                    src={activePhotoUrl}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 bg-stone-50">
                    <span className="text-xs font-mono">No Image Available</span>
                  </div>
                )}

                {listing.is_available && (
                  <div className="absolute top-3 left-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-white/95 text-emerald-800 shadow-sm backdrop-blur-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      Available
                    </span>
                  </div>
                )}
              </div>

              {/* Multiple Photo Thumbnails */}
              {allPhotos.length > 1 && (
                <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                  {allPhotos.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActivePhotoUrl(url)}
                      className={`relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                        activePhotoUrl === url
                          ? 'border-[#1B3B2B] shadow-xs'
                          : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <img
                        src={url}
                        alt={`Photo thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Price & Overview */}
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-stone-900 leading-tight">
                  {listing.title}
                </h2>

                <div className="mt-2.5 flex items-baseline space-x-2">
                  {listing.listing_type === 'lend' ? (
                    <div className="inline-flex items-center px-3 py-1 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold text-base">
                      <span>Free to Lend</span>
                    </div>
                  ) : (
                    <>
                      <span className="text-2xl font-extrabold text-[#1B3B2B]">
                        ₹{listing.price}
                      </span>
                      <span className="text-xs font-medium text-stone-500">
                        / {listing.pricing_unit}
                      </span>
                    </>
                  )}
                </div>

                {/* Refundable deposit note */}
                {listing.listing_type === 'rent' && Number(listing.deposit_amount) > 0 && (
                  <div className="mt-1.5 flex items-center space-x-1.5 text-xs text-stone-600">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-700" />
                    <span>
                      Refundable Deposit: <strong className="text-stone-800">₹{listing.deposit_amount}</strong>
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 text-stone-700 capitalize">
                  Condition: {listing.condition_display || listing.condition.replace('_', ' ')}
                </span>
                {listing.college && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 flex items-center">
                    <Building className="w-3 h-3 mr-1" />
                    {listing.college.short_code} Campus
                  </span>
                )}
              </div>

              {listing.pickup_location && (
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 flex items-start space-x-2 text-xs text-stone-700">
                  <MapPin className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-stone-900">Campus Pickup Location</span>
                    <span>{listing.pickup_location}</span>
                  </div>
                </div>
              )}

              {listing.description && (
                <div className="pt-1">
                  <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider font-mono mb-1">
                    Description
                  </h4>
                  <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-line">
                    {listing.description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Lender Profile Box */}
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {listing.lender.avatar_url ? (
                <img
                  src={listing.lender.avatar_url}
                  alt={listing.lender.full_name}
                  className="w-11 h-11 rounded-full object-cover border border-emerald-600/30"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-[#1B3B2B] text-amber-100 flex items-center justify-center font-bold text-sm shadow-xs">
                  {lenderInitial}
                </div>
              )}

              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold text-stone-900">
                    {listing.lender.full_name || listing.lender.username}
                  </span>
                  {listing.lender.is_college_verified && (
                    <span title="Verified Campus Student" className="inline-flex">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-stone-500">
                  {listing.lender.college_name}
                  {listing.lender.grad_year ? ` • Class of ${listing.lender.grad_year}` : ''}
                </p>
              </div>
            </div>

            <div className="text-right text-[11px] text-emerald-800 font-semibold">
              {isOwner ? 'Your Listing' : 'Peer Lender'}
            </div>
          </div>

          {/* Stage Note Banner */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 text-xs space-y-1">
            <div className="flex items-center space-x-2 font-bold text-emerald-900">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span>Real Campus Booking</span>
            </div>
            <p className="leading-relaxed text-emerald-900/90">
              Submit your proposed rental or purchase dates. The owner will review your request with snapshot-locked pricing terms.
            </p>
          </div>
        </div>

        {/* Footer Action */}
        <div className="px-6 py-4 border-t border-stone-100 bg-[#FBF8F3] flex items-center justify-between">
          <div className="text-xs text-stone-500">
            <span>Listed {new Date(listing.created_at).toLocaleDateString()}</span>
          </div>

          {isOwner ? (
            <button
              type="button"
              onClick={() => {
                onClose()
                if (onOpenEditListing) onOpenEditListing(listing)
              }}
              className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit My Listing</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              {user && onMessageOwner && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onMessageOwner(listing)
                  }}
                  className="px-4 py-2.5 rounded-full text-xs font-semibold text-[#1B3B2B] bg-white hover:bg-stone-50 border border-stone-200/90 shadow-2xs transition-all flex items-center space-x-1.5 cursor-pointer"
                  title="Direct message item owner"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-800" />
                  <span>Message Owner</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    openAuthModal('login')
                  } else if (onRequestBooking) {
                    onRequestBooking(listing)
                  }
                }}
                className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-sm transition-all cursor-pointer"
              >
                {user
                  ? listing.listing_type === 'sell'
                    ? 'Request to Buy'
                    : 'Request to Borrow / Rent'
                  : 'Sign In to Borrow'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
