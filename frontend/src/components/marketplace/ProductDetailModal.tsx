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
  Star,
  Clock,
  Shield,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import {
  type MarketplaceListing,
  type Review,
  getListingReviews,
} from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { TrustScoreModal } from './TrustScoreModal'

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
  const [reviews, setReviews] = useState<Review[]>([])
  const [isLoadingReviews, setIsLoadingReviews] = useState(false)
  const [isTrustScoreModalOpen, setIsTrustScoreModalOpen] = useState(false)

  useEffect(() => {
    if (listing) {
      if (listing.images && listing.images.length > 0) {
        setActivePhotoUrl(listing.images[0].image_url)
      } else {
        setActivePhotoUrl(listing.image_url || '')
      }

      // Fetch authentic borrower product reviews
      setIsLoadingReviews(true)
      getListingReviews(listing.id)
        .then((res) => {
          setReviews(res.reviews || [])
        })
        .catch(() => {
          setReviews([])
        })
        .finally(() => {
          setIsLoadingReviews(false)
        })
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-t-3xl sm:rounded-3xl bg-white border border-stone-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 max-h-[92vh] sm:max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-stone-100 bg-[#FBF8F3]">
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

          {/* Availability Status Banners */}
          {listing.availability_status === 'return_overdue' && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start space-x-2.5">
              <Clock className="w-4 h-4 text-rose-700 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <strong className="block font-bold">Return Overdue</strong>
                <p className="mt-0.5 text-[11px] text-rose-800 leading-relaxed">
                  This item has exceeded its agreed rental return timestamp. CampusShare has temporarily locked new bookings until physical return is verified by the lender.
                </p>
              </div>
            </div>
          )}

          {listing.availability_status === 'currently_booked' && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start space-x-2.5">
              <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Currently Booked</strong>
                <p className="mt-0.5 text-[11px] text-amber-800 leading-relaxed">
                  This item is currently out on rental{listing.booked_until ? ` until ${new Date(listing.booked_until).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : ''}. You may select future rental windows when requesting.
                </p>
              </div>
            </div>
          )}

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
                <div className="flex items-center space-x-1.5 flex-wrap">
                  <span className="text-xs font-bold text-stone-900">
                    {listing.lender.full_name || listing.lender.username}
                  </span>
                  {listing.lender.is_college_verified ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <ShieldCheck className="w-3 h-3 mr-0.5 text-emerald-700" />
                      Verified Student
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      <AlertCircle className="w-3 h-3 mr-0.5 text-amber-600" />
                      Unverified
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-stone-500">
                  {listing.lender.college_name}
                  {listing.lender.grad_year ? ` • Class of ${listing.lender.grad_year}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsTrustScoreModalOpen(true)}
                className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-950 text-xs font-bold flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                title="View explainable Trust Score and contributing factors"
              >
                <Shield className="w-3.5 h-3.5 text-emerald-700" />
                <span>Trust Score: {listing.lender.trust_score ?? 75}/100</span>
              </button>
              <span className="text-[11px] text-emerald-800 font-semibold">
                {isOwner ? 'Your Listing' : 'Peer Lender'}
              </span>
            </div>
          </div>

          {/* Authentic Product Reviews Section */}
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800 font-mono">
                  Borrower Reviews & Ratings
                </h4>
                {typeof listing.review_count === 'number' && listing.review_count > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 flex items-center space-x-1">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-600" />
                    <span>{Number(listing.average_rating || 5).toFixed(1)} ({listing.review_count})</span>
                  </span>
                )}
              </div>
              <span className="text-[10px] text-stone-400 font-medium">
                Post-return verified reviews only
              </span>
            </div>

            {isLoadingReviews ? (
              <div className="py-4 flex items-center justify-center space-y-2 text-stone-400">
                <Loader2 className="w-4 h-4 animate-spin text-[#1B3B2B]" />
              </div>
            ) : reviews.length === 0 ? (
              <p className="text-xs text-stone-500 italic">
                No reviews yet. Reviews can only be submitted by verified borrowers after completing a rental.
              </p>
            ) : (
              <div className="space-y-2.5">
                {reviews.map((r) => (
                  <div key={r.id} className="p-3 rounded-xl bg-white border border-stone-200/80 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 font-bold text-stone-900">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3 h-3 ${
                                star <= r.rating ? 'fill-amber-400 text-amber-500' : 'text-stone-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span>{r.reviewer?.full_name || r.reviewer?.username || 'Verified Student'}</span>
                      </div>
                      <span className="text-[10px] text-stone-400">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {r.comment && <p className="text-stone-600 text-[11px] leading-relaxed">{r.comment}</p>}
                  </div>
                ))}
              </div>
            )}
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
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-stone-100 bg-[#FBF8F3] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 safe-area-pb">
          <div className="hidden sm:block text-xs text-stone-500">
            <span>Listed {new Date(listing.created_at).toLocaleDateString()}</span>
          </div>

          {isOwner ? (
            <button
              type="button"
              onClick={() => {
                onClose()
                if (onOpenEditListing) onOpenEditListing(listing)
              }}
              className="w-full sm:w-auto px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit My Listing</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              {user && onMessageOwner && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onMessageOwner(listing)
                  }}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-full text-xs font-semibold text-[#1B3B2B] bg-white hover:bg-stone-50 border border-stone-200/90 shadow-2xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                  title="Direct message item owner"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-800" />
                  <span>Message Owner</span>
                </button>
              )}

              {listing.availability_status === 'return_overdue' ? (
                <button
                  type="button"
                  disabled
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-full text-xs font-bold text-stone-400 bg-stone-200 cursor-not-allowed shadow-none text-center"
                >
                  Unavailable — Return Overdue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!user) {
                      openAuthModal('login')
                    } else if (onRequestBooking) {
                      onRequestBooking(listing)
                    }
                  }}
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-sm transition-all cursor-pointer text-center"
                >
                  {user
                    ? listing.listing_type === 'sell'
                      ? 'Request to Buy'
                      : 'Request to Borrow / Rent'
                    : 'Sign In to Borrow'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lender Trust Score Modal */}
      <TrustScoreModal
        profileId={listing.lender.id}
        userName={listing.lender.full_name || listing.lender.username}
        isOpen={isTrustScoreModalOpen}
        onClose={() => setIsTrustScoreModalOpen(false)}
      />
    </div>
  )
}
