import { useState, useEffect, useCallback } from 'react'
import {
  X,
  FileText,
  Plus,
  Loader2,
  AlertCircle,
  MessageSquare,
  ShieldCheck,
  RotateCcw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react'
import {
  type WantedItemRequest,
  type MarketplaceListing,
  getWantedRequests,
  getWantedRequestDetail,
  respondToWantedRequest,
  actionWantedResponse,
  getMyListings,
  getMarketplaceListingDetail,
  resolveMediaUrl,
} from '../../services/api'
import { useAuth } from '../../context/AuthContext'

interface WantedRequestsModalProps {
  isOpen: boolean
  onClose: () => void
  onOpenPostRequest: () => void
  onSelectListing?: (listing: MarketplaceListing) => void
}

export function WantedRequestsModal({
  isOpen,
  onClose,
  onOpenPostRequest,
  onSelectListing,
}: WantedRequestsModalProps) {
  const { user, openAuthModal } = useAuth()
  const [activeTab, setActiveTab] = useState<'all' | 'mine'>('all')
  const [requests, setRequests] = useState<WantedItemRequest[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Expand request details & responses
  const [expandedRequestId, setExpandedRequestId] = useState<number | null>(null)
  const [detailedRequest, setDetailedRequest] = useState<WantedItemRequest | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  // Responding to a request
  const [respondingToId, setRespondingToId] = useState<number | null>(null)
  const [responseMessage, setResponseMessage] = useState('')
  const [responsePrice, setResponsePrice] = useState('')
  const [responseListingId, setResponseListingId] = useState<number | ''>('')
  const [myListings, setMyListings] = useState<MarketplaceListing[]>([])
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false)
  const [responseError, setResponseError] = useState<string | null>(null)

  const loadRequests = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await getWantedRequests({
        mine: activeTab === 'mine',
      })
      setRequests(res.requests)
    } catch (err: unknown) {
      console.error('Failed to load requests:', err)
      const rawMsg = err instanceof Error ? err.message : 'Failed to load requests.'
      setError(
        rawMsg.toLowerCase().includes('fetch')
          ? 'Unable to reach the campus server. Please verify your connection or retry.'
          : rawMsg
      )
      setRequests([])
    } finally {
      setIsLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    if (isOpen) {
      loadRequests()
    }
  }, [isOpen, loadRequests])

  // Load user's listings when they want to respond
  const handleStartResponding = async (req: WantedItemRequest) => {
    if (!user) {
      openAuthModal('login')
      return
    }
    setRespondingToId(req.id)
    setResponseMessage('')
    setResponsePrice('')
    setResponseListingId('')
    setResponseError(null)

    try {
      const data = await getMyListings('active')
      setMyListings(data.listings)
    } catch {
      setMyListings([])
    }
  }

  // Load detailed request with responses when expanded
  const handleToggleExpand = async (req: WantedItemRequest) => {
    if (expandedRequestId === req.id) {
      setExpandedRequestId(null)
      setDetailedRequest(null)
      return
    }

    setExpandedRequestId(req.id)
    setIsLoadingDetail(true)
    try {
      const detail = await getWantedRequestDetail(req.id)
      setDetailedRequest(detail)
    } catch (err: unknown) {
      console.error('Failed to load request detail:', err)
      setDetailedRequest(req)
    } finally {
      setIsLoadingDetail(false)
    }
  }

  const handleSubmitResponse = async (requestId: number) => {
    if (!responseMessage.trim()) {
      setResponseError('Please enter a message explaining what you can provide.')
      return
    }

    setIsSubmittingResponse(true)
    setResponseError(null)
    try {
      await respondToWantedRequest(requestId, {
        message: responseMessage.trim(),
        offered_price: responsePrice.trim() || undefined,
        offered_listing_id: responseListingId ? Number(responseListingId) : undefined,
      })
      setRespondingToId(null)
      setResponseMessage('')
      setResponsePrice('')
      setResponseListingId('')
      loadRequests()
      if (expandedRequestId === requestId) {
        handleToggleExpand(requests.find((r) => r.id === requestId)!)
      }
    } catch (err: unknown) {
      setResponseError(err instanceof Error ? err.message : 'Failed to send response.')
    } finally {
      setIsSubmittingResponse(false)
    }
  }

  const handleResponseAction = async (responseId: number, action: 'interested' | 'declined') => {
    try {
      await actionWantedResponse(responseId, action)
      if (expandedRequestId) {
        const detail = await getWantedRequestDetail(expandedRequestId)
        setDetailedRequest(detail)
      }
      loadRequests()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update response.')
    }
  }

  const handleViewOfferedListing = async (listingId: number) => {
    try {
      const listing = await getMarketplaceListingDetail(listingId)
      if (onSelectListing) {
        onClose()
        onSelectListing(listing)
      }
    } catch (err: unknown) {
      alert('Could not open listing details.')
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-t-3xl sm:rounded-3xl bg-white border border-stone-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 max-h-[94vh] sm:max-h-[90vh] flex flex-col"
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
              <h3 className="text-sm sm:text-base font-bold text-stone-900 truncate">Campus Wanted Items</h3>
              <p className="text-[11px] sm:text-xs text-stone-500 truncate">Student requests for gear not currently listed</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (!user) {
                  openAuthModal('login')
                } else {
                  onClose()
                  onOpenPostRequest()
                }
              }}
              className="px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-xs transition-colors flex items-center space-x-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Post Request</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="px-3 sm:px-6 py-2.5 sm:py-3 border-b border-stone-100 bg-white flex items-center justify-between overflow-x-auto scrollbar-none touch-pan-x touch-scroll">
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[#1B3B2B] text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              All Campus Requests
            </button>
            {user && (
              <button
                type="button"
                onClick={() => setActiveTab('mine')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'mine'
                    ? 'bg-[#1B3B2B] text-white shadow-xs'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                My Requests
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={loadRequests}
            disabled={isLoading}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            title="Refresh"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-800' : ''}`} />
          </button>
        </div>

        {/* Content List */}
        <div className="overflow-y-auto p-6 space-y-4 flex-1">
          {isLoading && requests.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-7 h-7 text-emerald-800 animate-spin mx-auto" />
              <p className="text-xs text-stone-500 font-medium">Loading campus requests...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span className="font-medium">{error}</span>
              </div>
              <button
                type="button"
                onClick={() => loadRequests()}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold text-rose-900 bg-rose-100 hover:bg-rose-200 border border-rose-300 transition-colors cursor-pointer shrink-0"
              >
                Try Again
              </button>
            </div>
          ) : requests.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-stone-700">No open requests</h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Looking for a textbook, lab coat, or camera? Post a request and peers on your campus can offer theirs.
              </p>
            </div>
          ) : (
            requests.map((req) => {
              const isRequester = user && req.requester.id === user.id
              const isResponding = respondingToId === req.id
              const isExpanded = expandedRequestId === req.id
              const responses = isExpanded && detailedRequest ? detailedRequest.responses || [] : []

              return (
                <div
                  key={req.id}
                  className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200/90 shadow-2xs hover:shadow-xs transition-all space-y-3.5"
                >
                  {/* Top Bar: Requester & Intent */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center space-x-3 min-w-0">
                      {req.requester.avatar_url ? (
                        <img
                          src={resolveMediaUrl(req.requester.avatar_url)}
                          alt={req.requester.full_name}
                          onError={(e) => {
                            e.currentTarget.onerror = null
                            e.currentTarget.src = req.requester.default_avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.requester.full_name || req.requester.username)}&background=1B3B2B&color=fff&size=200`
                          }}
                          className="w-10 h-10 rounded-full object-cover border border-emerald-600/30 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#1B3B2B] text-amber-100 flex items-center justify-center font-bold text-xs shrink-0">
                          {(req.requester.full_name || req.requester.username).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-bold text-stone-900 truncate">
                            {req.requester.full_name || req.requester.username}
                          </span>
                          {req.requester.is_verified && (
                            <span title="Verified Campus Student" className="inline-flex">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-500 truncate">
                          {req.requester.college_name}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900">
                        {req.category?.name || 'General'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-700">
                        {req.request_type === 'borrow' ? 'Free Borrow' : req.request_type === 'rent' ? 'Rental' : 'Buy'}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h4 className="text-sm font-bold text-stone-900">{req.title}</h4>
                    {req.description && (
                      <p className="text-xs text-stone-600 mt-1 whitespace-pre-line leading-relaxed">
                        {req.description}
                      </p>
                    )}
                  </div>

                  {/* Request Metadata Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-stone-50 border border-stone-100 text-xs">
                    {req.budget && (
                      <div>
                        <span className="text-[10px] text-stone-500 uppercase tracking-wider font-mono block">
                          Budget
                        </span>
                        <span className="font-bold text-[#1B3B2B]">₹{req.budget}</span>
                      </div>
                    )}
                    {req.needed_date && (
                      <div>
                        <span className="text-[10px] text-stone-500 uppercase tracking-wider font-mono block">
                          Needed Date
                        </span>
                        <span className="font-semibold text-stone-800">{req.needed_date}</span>
                      </div>
                    )}
                    {req.preferred_terms && (
                      <div>
                        <span className="text-[10px] text-stone-500 uppercase tracking-wider font-mono block">
                          Terms
                        </span>
                        <span className="font-semibold text-stone-800">{req.preferred_terms}</span>
                      </div>
                    )}
                    {req.notes && (
                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-stone-500 uppercase tracking-wider font-mono block">
                          Pickup Notes
                        </span>
                        <span className="text-stone-700 truncate block">{req.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer & Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs">
                    <button
                      type="button"
                      onClick={() => handleToggleExpand(req)}
                      className="text-[11px] font-semibold text-emerald-800 hover:underline flex items-center space-x-1 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{req.responses_count} offer{req.responses_count === 1 ? '' : 's'} received</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {!isRequester && (
                      <button
                        type="button"
                        onClick={() => handleStartResponding(req)}
                        className="px-4 py-1.5 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-2xs transition-colors cursor-pointer flex items-center space-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Offer This Item</span>
                      </button>
                    )}
                  </div>

                  {/* Inline Offer Form for peer */}
                  {isResponding && (
                    <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold text-emerald-950">
                          Offer your gear to {req.requester.full_name || req.requester.username}
                        </h5>
                        <button
                          type="button"
                          onClick={() => setRespondingToId(null)}
                          className="text-stone-400 hover:text-stone-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          Your Message & Condition Note <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          rows={2}
                          value={responseMessage}
                          onChange={(e) => setResponseMessage(e.target.value)}
                          placeholder="e.g. I have this exact calculator in like-new condition. You can borrow it for your exam!"
                          className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-[#1B3B2B] resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            Offered Price (₹) <span className="text-stone-400 font-normal">(Optional)</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder="e.g. 50"
                            value={responsePrice}
                            onChange={(e) => setResponsePrice(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-[#1B3B2B]"
                          />
                        </div>

                        {myListings.length > 0 && (
                          <div>
                            <label className="block text-xs font-semibold text-stone-700 mb-1">
                              Link One of Your Listings <span className="text-stone-400 font-normal">(Optional)</span>
                            </label>
                            <select
                              value={responseListingId}
                              onChange={(e) => setResponseListingId(e.target.value ? Number(e.target.value) : '')}
                              className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-[#1B3B2B]"
                            >
                              <option value="">None (Custom Offer)</option>
                              {myListings.map((l) => (
                                <option key={l.id} value={l.id}>
                                  {l.title} (₹{l.price}/{l.pricing_unit})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {responseError && (
                        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{responseError}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-end space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setRespondingToId(null)}
                          disabled={isSubmittingResponse}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-200/60 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSubmitResponse(req.id)}
                          disabled={isSubmittingResponse}
                          className="px-5 py-1.5 rounded-lg text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] disabled:opacity-50 transition-all cursor-pointer flex items-center space-x-1"
                        >
                          {isSubmittingResponse ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Sending...</span>
                            </>
                          ) : (
                            <span>Send Offer</span>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Expanded Section: Responses for requester or curious peers */}
                  {isExpanded && (
                    <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-3 animate-in fade-in">
                      <h5 className="text-xs font-bold text-stone-900 uppercase tracking-wider font-mono">
                        Offers Received ({responses.length})
                      </h5>

                      {isLoadingDetail ? (
                        <div className="py-4 text-center">
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-800 mx-auto" />
                        </div>
                      ) : responses.length === 0 ? (
                        <p className="text-xs text-stone-500 py-2 text-center">
                          No offers yet. Other students will see this request on the campus feed.
                        </p>
                      ) : (
                        responses.map((resp) => (
                          <div
                            key={resp.id}
                            className="p-3 rounded-xl bg-white border border-stone-200 shadow-2xs space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-stone-900">
                                  {resp.responder.full_name || resp.responder.username}
                                </span>
                                {resp.responder.is_verified && (
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                                )}
                                <span className="text-stone-400">•</span>
                                <span className="text-stone-500">{resp.responder.college_name}</span>
                              </div>

                              <div>
                                {resp.status === 'interested' ? (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 inline-flex items-center space-x-1">
                                    <Check className="w-3 h-3 text-emerald-700" />
                                    <span>Offer Accepted</span>
                                  </span>
                                ) : resp.status === 'declined' ? (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                    Declined
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600">
                                    Pending Review
                                  </span>
                                )}
                              </div>
                            </div>

                            <p className="text-stone-700 whitespace-pre-line">{resp.message}</p>

                            <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                              <div className="flex items-center space-x-3">
                                {resp.offered_price && (
                                  <span className="font-bold text-[#1B3B2B]">
                                    Offered: ₹{resp.offered_price}
                                  </span>
                                )}
                                {resp.offered_listing && (
                                  <button
                                    type="button"
                                    onClick={() => handleViewOfferedListing(resp.offered_listing!.id)}
                                    className="text-[11px] font-bold text-emerald-800 hover:underline flex items-center space-x-1 cursor-pointer"
                                  >
                                    <span>View Listed Item ({resp.offered_listing.title})</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                )}
                              </div>

                              {/* Actions for the Requester */}
                              {isRequester && resp.status === 'pending' && (
                                <div className="flex items-center space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => handleResponseAction(resp.id, 'declined')}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 cursor-pointer"
                                  >
                                    Decline
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleResponseAction(resp.id, 'interested')}
                                    className="px-3.5 py-1 rounded-lg text-[11px] font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] cursor-pointer inline-flex items-center space-x-1 shadow-2xs"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Accept Offer</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
