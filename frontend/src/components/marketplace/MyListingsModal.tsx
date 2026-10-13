import { useState, useEffect, useCallback } from 'react'
import {
  X,
  Tag,
  Plus,
  Edit3,
  Archive,
  RefreshCw,
  AlertCircle,
  Building,
  MapPin,
  CheckCircle2,
  EyeOff,
  AlertTriangle,
} from 'lucide-react'
import {
  type MarketplaceListing,
  getMyListings,
  archiveMarketplaceListing,
  updateMarketplaceListing,
} from '../../services/api'
import { useAuth } from '../../context/AuthContext'

interface MyListingsModalProps {
  isOpen: boolean
  onClose: () => void
  onOpenPostItem: () => void
  onEditListing: (listing: MarketplaceListing) => void
}

type StatusFilter = 'all' | 'published' | 'unavailable' | 'archived'

export function MyListingsModal({
  isOpen,
  onClose,
  onOpenPostItem,
  onEditListing,
}: MyListingsModalProps) {
  const { user } = useAuth()

  const [listings, setListings] = useState<MarketplaceListing[]>([])
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Archive confirmation dialog state
  const [listingToArchive, setListingToArchive] = useState<MarketplaceListing | null>(null)
  const [isArchiving, setIsArchiving] = useState(false)
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null)

  // Toggle availability in-progress ID
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const fetchMyListings = useCallback(async () => {
    if (!isOpen || !user) return

    setIsLoading(true)
    setErrorMsg(null)

    try {
      const data = await getMyListings()
      setListings(data.listings)
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to load your listings.')
      setListings([])
    } finally {
      setIsLoading(false)
    }
  }, [isOpen, user])

  useEffect(() => {
    if (isOpen) {
      fetchMyListings()
      setActionSuccessMsg(null)
      setListingToArchive(null)
    }
  }, [isOpen, fetchMyListings])

  if (!isOpen) return null

  // Filter listings locally for instant responsiveness
  const filteredListings = listings.filter((item) => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'published') return item.status === 'active' && item.is_available
    if (activeFilter === 'unavailable') return (item.status === 'unavailable' || !item.is_available) && item.status !== 'archived'
    if (activeFilter === 'archived') return item.status === 'archived'
    return true
  })

  // Status counts
  const publishedCount = listings.filter((i) => i.status === 'active' && i.is_available).length
  const unavailableCount = listings.filter((i) => (i.status === 'unavailable' || !i.is_available) && i.status !== 'archived').length
  const archivedCount = listings.filter((i) => i.status === 'archived').length

  // Quick toggle availability
  const handleToggleAvailability = async (item: MarketplaceListing) => {
    if (item.status === 'archived') return

    setTogglingId(item.id)
    try {
      const nextAvailability = !item.is_available
      const updated = await updateMarketplaceListing(item.id, {
        is_available: nextAvailability,
        status: nextAvailability ? 'active' : 'unavailable',
      })
      setListings((prev) => prev.map((l) => (l.id === item.id ? updated : l)))
      setActionSuccessMsg(
        nextAvailability
          ? `"${item.title}" is now published and visible to peers.`
          : `"${item.title}" is paused and marked unavailable.`
      )
      setTimeout(() => setActionSuccessMsg(null), 3000)
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update availability status.')
    } finally {
      setTogglingId(null)
    }
  }

  // Handle archive confirmation
  const handleConfirmArchive = async () => {
    if (!listingToArchive) return

    setIsArchiving(true)
    try {
      const res = await archiveMarketplaceListing(listingToArchive.id)
      setListings((prev) =>
        prev.map((l) => (l.id === listingToArchive.id ? res.listing : l))
      )
      setActionSuccessMsg(`"${listingToArchive.title}" has been archived.`)
      setListingToArchive(null)
      setTimeout(() => setActionSuccessMsg(null), 3000)
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to archive listing.')
    } finally {
      setIsArchiving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[94vh] sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white border border-stone-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-100 bg-[#FBF8F3]">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#1B3B2B] text-emerald-100 flex items-center justify-center shadow-xs shrink-0">
              <Tag className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-bold text-stone-900 truncate">
                My Campus Listings
              </h2>
              <p className="text-[11px] sm:text-xs text-stone-500 truncate">
                Manage your shared, rented, and sold items across campus
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenPostItem()
              }}
              className="inline-flex items-center space-x-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Post Item</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="px-3 sm:px-6 py-2.5 sm:py-3 border-b border-stone-100 bg-stone-50/50 flex items-center space-x-2 overflow-x-auto scrollbar-none touch-pan-x touch-scroll">
          {[
            { id: 'all' as const, label: 'All Items', count: listings.length },
            { id: 'published' as const, label: 'Published', count: publishedCount },
            { id: 'unavailable' as const, label: 'Unavailable / Paused', count: unavailableCount },
            { id: 'archived' as const, label: 'Archived', count: archivedCount },
          ].map((tab) => {
            const isActive = activeFilter === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-[#1B3B2B] text-white shadow-2xs'
                    : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200/80 hover:bg-stone-100/60'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-emerald-800 text-white' : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Feedback Banners */}
        {actionSuccessMsg && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={fetchMyListings}
              className="text-xs font-bold underline hover:text-rose-900 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            /* Loading State */
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-stone-50 border border-stone-200 animate-pulse flex items-center space-x-4"
                >
                  <div className="w-20 h-20 rounded-xl bg-stone-200 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-stone-200 rounded w-1/3" />
                    <div className="h-3 bg-stone-200 rounded w-1/4" />
                    <div className="h-3 bg-stone-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredListings.length === 0 ? (
            /* Empty State */
            <div className="p-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto shadow-xs">
                <Tag className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-base font-bold text-stone-900">
                  {activeFilter === 'all'
                    ? "You haven't listed any items yet"
                    : `No ${activeFilter} listings found`}
                </h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  {activeFilter === 'all'
                    ? 'Start sharing textbooks, electronics, or gear with students on your campus.'
                    : `You have no listings categorized under "${activeFilter}".`}
                </p>
              </div>

              {activeFilter === 'all' && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onOpenPostItem()
                  }}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Your First Listing</span>
                </button>
              )}
            </div>
          ) : (
            /* Real Listings List */
            <div className="space-y-3.5">
              {filteredListings.map((item) => {
                const isItemArchived = item.status === 'archived'
                const isToggling = togglingId === item.id

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                      isItemArchived
                        ? 'bg-stone-50/70 border-stone-200 opacity-75'
                        : item.is_available
                        ? 'bg-white border-stone-200 shadow-2xs hover:shadow-xs'
                        : 'bg-amber-50/30 border-amber-200/80'
                    }`}
                  >
                    {/* Left: Thumbnail & Details */}
                    <div className="flex items-start space-x-3.5 min-w-0 flex-1">
                      {/* Photo Thumbnail */}
                      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 bg-stone-50">
                            <Tag className="w-5 h-5 text-stone-300" />
                            <span className="text-[9px] font-mono mt-1 text-stone-400">No Photo</span>
                          </div>
                        )}

                        {/* Listing type badge */}
                        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-black/75 text-white">
                          {item.listing_type}
                        </div>
                      </div>

                      {/* Content details */}
                      <div className="min-w-0 space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-sm font-bold text-stone-900 truncate">
                            {item.title}
                          </h3>

                          {/* Status Badge */}
                          {isItemArchived ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-200 text-stone-700">
                              <Archive className="w-3 h-3 mr-1" />
                              Archived
                            </span>
                          ) : item.is_available ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                              Published
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <EyeOff className="w-3 h-3 mr-1 text-amber-600" />
                              Unavailable
                            </span>
                          )}
                        </div>

                        {/* Category & Campus */}
                        <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-stone-500">
                          <span className="font-medium text-stone-700">
                            {item.category?.name}
                          </span>
                          {item.subcategory && <span>• {item.subcategory}</span>}
                          {item.college && (
                            <span className="flex items-center">
                              • <Building className="w-3 h-3 mx-1 text-stone-400" />
                              {item.college.short_code}
                            </span>
                          )}
                        </div>

                        {/* Price & Deposit */}
                        <div className="flex items-baseline space-x-2 pt-0.5">
                          {item.listing_type === 'lend' ? (
                            <span className="text-xs font-bold text-emerald-800">
                              Free to lend
                            </span>
                          ) : (
                            <>
                              <span className="text-sm font-extrabold text-[#1B3B2B]">
                                ₹{item.price}
                              </span>
                              <span className="text-[11px] text-stone-500">
                                / {item.pricing_unit}
                              </span>
                            </>
                          )}

                          {item.listing_type === 'rent' && Number(item.deposit_amount) > 0 && (
                            <span className="text-[11px] text-stone-400">
                              (Deposit: ₹{item.deposit_amount})
                            </span>
                          )}
                        </div>

                        {/* Pickup detail */}
                        {item.pickup_location && (
                          <div className="text-[11px] text-stone-500 flex items-center space-x-1 pt-0.5">
                            <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                            <span className="truncate">{item.pickup_location}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                      {/* Availability Switch (unless archived) */}
                      {!isItemArchived && (
                        <div className="flex items-center space-x-2">
                          <span className="text-[11px] font-semibold text-stone-600">
                            {item.is_available ? 'Available' : 'Paused'}
                          </span>
                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => handleToggleAvailability(item)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                              item.is_available ? 'bg-[#1B3B2B]' : 'bg-stone-300'
                            }`}
                            title={item.is_available ? 'Mark item as unavailable' : 'Mark item as available'}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                item.is_available ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center space-x-1.5">
                        {!isItemArchived && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose()
                              onEditListing(item)
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center space-x-1 cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3 text-stone-600" />
                            <span>Edit</span>
                          </button>
                        )}

                        {!isItemArchived && (
                          <button
                            type="button"
                            onClick={() => setListingToArchive(item)}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200/60 transition-colors flex items-center space-x-1 cursor-pointer"
                            title="Archive this listing"
                          >
                            <Archive className="w-3 h-3" />
                            <span>Archive</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Confirmation Modal for Archiving */}
        {listingToArchive && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-in fade-in-50"
            onClick={() => setListingToArchive(null)}
          >
            <div
              className="w-full max-w-md rounded-3xl bg-white border border-stone-200 shadow-2xl p-6 space-y-4 animate-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1.5">
                <h3 className="text-base font-bold text-stone-900">
                  Archive "{listingToArchive.title}"?
                </h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Archiving removes this item from the active discovery feed. It will be marked as archived in your listings and won't appear in campus searches.
                </p>
              </div>

              <div className="flex items-center justify-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setListingToArchive(null)}
                  className="px-4 py-2.5 rounded-full text-xs font-semibold text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isArchiving}
                  onClick={handleConfirmArchive}
                  className="px-5 py-2.5 rounded-full text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-all disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
                >
                  {isArchiving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Archiving...</span>
                    </>
                  ) : (
                    <span>Confirm Archive</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
