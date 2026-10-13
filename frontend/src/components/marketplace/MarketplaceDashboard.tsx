import { useState, useEffect, useCallback } from 'react'
import {
  type College,
  type MarketplaceCategory,
  type MarketplaceListing,
  getColleges,
  getMarketplaceCategories,
  getMarketplaceListings,
  getUnreadCounts,
  startConversation,
} from '../../services/api'
import {
  Home,
  Search,
  Plus,
  Calendar,
  Menu,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { MarketplaceTopBar } from './MarketplaceTopBar'
import { MarketplaceLeftSidebar, type NavTab } from './MarketplaceLeftSidebar'
import { MarketplaceRightSidebar } from './MarketplaceRightSidebar'
import { MarketplaceHeroBanner } from './MarketplaceHeroBanner'
import { MarketplaceProductGrid } from './MarketplaceProductGrid'
import { PostItemModal } from './PostItemModal'
import { MyListingsModal } from './MyListingsModal'
import { PostRequestModal } from './PostRequestModal'
import { ProductDetailModal } from './ProductDetailModal'
import { SustainabilityModal } from './SustainabilityModal'
import { BookingRequestModal } from './BookingRequestModal'
import { MyBookingsModal } from './MyBookingsModal'
import { IncomingRequestsModal } from './IncomingRequestsModal'
import { WantedRequestsModal } from './WantedRequestsModal'
import { NotificationsModal } from './NotificationsModal'
import { MessagesModal } from './MessagesModal'


interface MarketplaceDashboardProps {
  onGoToLanding: () => void
  initialCategory?: string
}

export function MarketplaceDashboard({
  onGoToLanding,
  initialCategory = 'all',
}: MarketplaceDashboardProps) {
  const { user, openAuthModal } = useAuth()

  // Data states
  const [colleges, setColleges] = useState<College[]>([])
  const [categories, setCategories] = useState<MarketplaceCategory[]>([])
  const [listings, setListings] = useState<MarketplaceListing[]>([])

  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategorySlug, setSelectedCategorySlug] = useState(initialCategory.toLowerCase())
  const [selectedCollegeIds, setSelectedCollegeIds] = useState<number[]>([])
  const [activeTab, setActiveTab] = useState<NavTab>('Home')

  // UI / Modal states
  const [isLoadingListings, setIsLoadingListings] = useState(true)
  const [listingsError, setListingsError] = useState<string | null>(null)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const [isPostItemOpen, setIsPostItemOpen] = useState(false)
  const [isMyListingsOpen, setIsMyListingsOpen] = useState(false)
  const [editingListing, setEditingListing] = useState<MarketplaceListing | null>(null)
  const [isPostRequestOpen, setIsPostRequestOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceListing | null>(null)
  const [isSustainabilityOpen, setIsSustainabilityOpen] = useState(false)

  // Stage 6 Modal States
  const [isBookingRequestOpen, setIsBookingRequestOpen] = useState(false)
  const [bookingTargetListing, setBookingTargetListing] = useState<MarketplaceListing | null>(null)
  const [isMyBookingsOpen, setIsMyBookingsOpen] = useState(false)
  const [isIncomingRequestsOpen, setIsIncomingRequestsOpen] = useState(false)
  const [isWantedRequestsOpen, setIsWantedRequestsOpen] = useState(false)

  // Stage 9: Notifications & Messaging States
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isMessagesOpen, setIsMessagesOpen] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null)
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0)
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0)

  // Real-time unread badges polling
  const fetchUnreadCounts = useCallback(async () => {
    if (!user) {
      setUnreadNotificationsCount(0)
      setUnreadMessagesCount(0)
      return
    }
    try {
      const counts = await getUnreadCounts()
      setUnreadNotificationsCount(counts.notifications_unread || 0)
      setUnreadMessagesCount(counts.messages_unread || 0)
    } catch (_err) {
      // background polling fallback
    }
  }, [user])

  useEffect(() => {
    fetchUnreadCounts()
    if (!user) return

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchUnreadCounts()
      }
    }, 12000)

    return () => clearInterval(timer)
  }, [fetchUnreadCounts, user])

  const handleNotificationNavigate = (targetModal: string, targetId?: string) => {
    if (targetModal === 'incoming_bookings') {
      setIsIncomingRequestsOpen(true)
    } else if (targetModal === 'my_bookings' || targetModal === 'financials') {
      setIsMyBookingsOpen(true)
    } else if (targetModal === 'wanted') {
      setIsWantedRequestsOpen(true)
    } else if (targetModal === 'messages') {
      if (targetId) {
        setActiveConversationId(parseInt(targetId))
      }
      setIsMessagesOpen(true)
    }
  }

  const handleMessageOwner = async (listing: MarketplaceListing) => {
    if (!user) {
      openAuthModal('login')
      return
    }
    try {
      const conv = await startConversation({ listing_id: listing.id })
      setActiveConversationId(conv.id)
      setIsMessagesOpen(true)
      fetchUnreadCounts()
    } catch (err: any) {
      alert(err?.message || 'Could not initiate conversation.')
    }
  }


  // Wishlist state (persisted locally)
  const [wishlistIds, setWishlistIds] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem('campusshare_wishlist')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  const toggleWishlist = (id: number) => {
    setWishlistIds((prev) => {
      const next = prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      try {
        localStorage.setItem('campusshare_wishlist', JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  // 1. Load Colleges & Categories on mount
  useEffect(() => {
    let ignore = false

    Promise.all([getColleges(), getMarketplaceCategories()])
      .then(([collegesRes, categoriesRes]) => {
        if (!ignore) {
          setColleges(collegesRes.colleges)
          setCategories(categoriesRes.categories)

          // Default discovery to user's college if authenticated, otherwise all
          if (user?.college?.id) {
            setSelectedCollegeIds([user.college.id])
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load initial marketplace data:', err)
      })

    return () => {
      ignore = true
    }
  }, [user])

  // 2. Fetch Listings when filters change
  const fetchListings = useCallback(async () => {
    setIsLoadingListings(true)
    setListingsError(null)

    try {
      const data = await getMarketplaceListings({
        search: searchQuery.trim() || undefined,
        category: selectedCategorySlug !== 'all' ? selectedCategorySlug : undefined,
        college_ids: selectedCollegeIds.length > 0 ? selectedCollegeIds : undefined,
      })
      setListings(data.listings)
    } catch (err: unknown) {
      setListingsError(err instanceof Error ? err.message : 'Unable to connect to marketplace service.')
      setListings([])
    } finally {
      setIsLoadingListings(false)
    }
  }, [searchQuery, selectedCategorySlug, selectedCollegeIds])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchListings()
    }, 250)
    return () => clearTimeout(timer)
  }, [fetchListings])

  // Handlers for college filtering
  const handleToggleCollege = (collegeId: number) => {
    setSelectedCollegeIds((prev) => {
      if (prev.includes(collegeId)) {
        return prev.filter((id) => id !== collegeId)
      } else {
        return [...prev, collegeId]
      }
    })
  }

  const handleSelectSingleCollege = (collegeId: number | null) => {
    if (collegeId === null) {
      setSelectedCollegeIds([])
    } else {
      setSelectedCollegeIds([collegeId])
    }
  }

  const handleSelectAllColleges = () => {
    setSelectedCollegeIds([])
  }

  const handleClearFilters = () => {
    setSearchQuery('')
    setSelectedCategorySlug('all')
    setSelectedCollegeIds([])
  }

  // Handle Tab navigation
  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab)
    if (tab === 'Profile') {
      if (user) {
        openAuthModal('profile-view')
      } else {
        openAuthModal('login')
      }
    } else if (tab === 'Home' || tab === 'Browse' || tab === 'Categories') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (tab === 'My Bookings') {
      if (!user) {
        openAuthModal('login')
      } else {
        setIsMyBookingsOpen(true)
      }
    } else if (tab === 'Requests') {
      setIsWantedRequestsOpen(true)
    } else if (tab === 'My Listings') {
      if (!user) {
        openAuthModal('login')
      } else {
        setIsMyListingsOpen(true)
      }
    } else if (tab === 'Messages') {
      if (!user) {
        openAuthModal('login')
      } else {
        setIsMessagesOpen(true)
      }
    } else if (tab === 'Notifications') {
      if (!user) {
        openAuthModal('login')
      } else {
        setIsNotificationsOpen(true)
      }
    }

  }

  // Determine subtext
  const collegeSubtext =
    selectedCollegeIds.length === 1
      ? `Items from ${colleges.find((c) => c.id === selectedCollegeIds[0])?.name || 'selected campus'}`
      : selectedCollegeIds.length > 1
      ? `Items from ${selectedCollegeIds.length} selected campuses`
      : 'Items from Coimbatore Institute of Technology and nearby colleges'

  return (
    <div className="min-h-screen bg-[#FBF8F3] text-stone-900 flex flex-col font-sans selection:bg-emerald-200 selection:text-emerald-900">
      {/* Top Bar matching reference */}
      <MarketplaceTopBar
        colleges={colleges}
        selectedCollegeId={selectedCollegeIds.length === 1 ? selectedCollegeIds[0] : null}
        onSelectCollege={handleSelectSingleCollege}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onToggleMobileMenu={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        onOpenNotifications={() => {
          if (!user) {
            openAuthModal('login')
          } else {
            setIsNotificationsOpen(true)
          }
        }}
        onOpenMessages={() => {
          if (!user) {
            openAuthModal('login')
          } else {
            setIsMessagesOpen(true)
          }
        }}
        unreadNotificationsCount={unreadNotificationsCount}
        unreadMessagesCount={unreadMessagesCount}
        onOpenWishlist={() => alert(`You have ${wishlistIds.length} items saved in your wishlist.`)}
        onGoToLanding={onGoToLanding}
      />

      {/* Main 3-Column Layout matching reference */}
      <div className="flex-1 max-w-[1700px] w-full mx-auto flex overflow-hidden">
        {/* 1. Left Sidebar (Desktop) */}
        <div className="hidden lg:block shrink-0">
          <MarketplaceLeftSidebar
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
            colleges={colleges}
            selectedCollegeIds={selectedCollegeIds}
            onToggleCollege={handleToggleCollege}
            onSelectAllColleges={handleSelectAllColleges}
            onOpenSustainability={() => setIsSustainabilityOpen(true)}
            onOpenAddCollege={() => alert('New colleges are automatically registered when students register with their university email!')}
            onGoToLanding={onGoToLanding}
            unreadNotificationsCount={unreadNotificationsCount}
            unreadMessagesCount={unreadMessagesCount}
          />
        </div>

        {/* 1b. Left Sidebar (Mobile Drawer) */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="relative z-10 w-72 h-full bg-[#FBF8F3] shadow-2xl">
              <MarketplaceLeftSidebar
                activeTab={activeTab}
                onSelectTab={handleSelectTab}
                colleges={colleges}
                selectedCollegeIds={selectedCollegeIds}
                onToggleCollege={handleToggleCollege}
                onSelectAllColleges={handleSelectAllColleges}
                onOpenSustainability={() => {
                  setMobileSidebarOpen(false)
                  setIsSustainabilityOpen(true)
                }}
                onOpenAddCollege={() => alert('New colleges are registered via verified email domains.')}
                onGoToLanding={onGoToLanding}
                onCloseMobile={() => setMobileSidebarOpen(false)}
                unreadNotificationsCount={unreadNotificationsCount}
                unreadMessagesCount={unreadMessagesCount}
              />
            </div>
          </div>
        )}

        {/* 2. Center Feed */}
        <main className="flex-1 min-w-0 p-3 sm:p-6 lg:p-7 pb-24 lg:pb-7 overflow-y-auto space-y-5 sm:space-y-7">
          {/* Hero Promotional Banner */}
          <MarketplaceHeroBanner
            categories={categories}
            selectedCategorySlug={selectedCategorySlug}
            onSelectCategory={setSelectedCategorySlug}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSearchSubmit={fetchListings}
          />

          {/* Product Feed & Categories */}
          <MarketplaceProductGrid
            categories={categories}
            selectedCategorySlug={selectedCategorySlug}
            onSelectCategory={setSelectedCategorySlug}
            listings={listings}
            isLoading={isLoadingListings}
            error={listingsError}
            onRetry={fetchListings}
            onSelectListing={(item) => setSelectedProduct(item)}
            onOpenPostItem={() => setIsPostItemOpen(true)}
            onClearFilters={handleClearFilters}
            collegeSubtext={collegeSubtext}
            wishlistIds={wishlistIds}
            onToggleWishlist={toggleWishlist}
          />
        </main>

        {/* 3. Right Sidebar (Desktop / Large Screens) */}
        <div className="hidden xl:block shrink-0">
          <MarketplaceRightSidebar
            onOpenPostItem={() => {
              setEditingListing(null)
              setIsPostItemOpen(true)
            }}
            onOpenPostRequest={() => {
              if (!user) {
                openAuthModal('login')
              } else {
                setIsPostRequestOpen(true)
              }
            }}
            onViewBookings={() => {
              if (!user) {
                openAuthModal('login')
              } else {
                setIsMyBookingsOpen(true)
              }
            }}
            onViewRequests={() => setIsWantedRequestsOpen(true)}
            onOpenMyListings={() => setIsMyListingsOpen(true)}
            onOpenIncomingRequests={() => setIsIncomingRequestsOpen(true)}
          />
        </div>
      </div>

      {/* Action Modals */}
      <PostItemModal
        isOpen={isPostItemOpen}
        onClose={() => {
          setIsPostItemOpen(false)
          setEditingListing(null)
        }}
        categories={categories}
        colleges={colleges}
        initialListing={editingListing}
        onListingSaved={() => {
          fetchListings()
        }}
      />

      <MyListingsModal
        isOpen={isMyListingsOpen}
        onClose={() => setIsMyListingsOpen(false)}
        onOpenPostItem={() => {
          setEditingListing(null)
          setIsPostItemOpen(true)
        }}
        onEditListing={(item) => {
          setEditingListing(item)
          setIsPostItemOpen(true)
        }}
      />

      <ProductDetailModal
        listing={selectedProduct}
        isOpen={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        isWishlisted={selectedProduct ? wishlistIds.includes(selectedProduct.id) : false}
        onToggleWishlist={toggleWishlist}
        onOpenEditListing={(item) => {
          setEditingListing(item)
          setIsPostItemOpen(true)
        }}
        onRequestBooking={(item) => {
          setBookingTargetListing(item)
          setIsBookingRequestOpen(true)
        }}
        onMessageOwner={handleMessageOwner}
      />

      <BookingRequestModal
        listing={bookingTargetListing}
        isOpen={isBookingRequestOpen}
        onClose={() => {
          setIsBookingRequestOpen(false)
          setBookingTargetListing(null)
        }}
        onBookingSuccess={() => {
          setIsBookingRequestOpen(false)
          setBookingTargetListing(null)
          setSelectedProduct(null)
          setIsMyBookingsOpen(true)
          fetchUnreadCounts()
        }}
      />

      <MyBookingsModal
        isOpen={isMyBookingsOpen}
        onClose={() => {
          setIsMyBookingsOpen(false)
          fetchUnreadCounts()
        }}
        onOpenIncomingRequests={() => setIsIncomingRequestsOpen(true)}
      />

      <IncomingRequestsModal
        isOpen={isIncomingRequestsOpen}
        onClose={() => {
          setIsIncomingRequestsOpen(false)
          fetchUnreadCounts()
        }}
        onOpenMyBookings={() => setIsMyBookingsOpen(true)}
      />

      <WantedRequestsModal
        isOpen={isWantedRequestsOpen}
        onClose={() => {
          setIsWantedRequestsOpen(false)
          fetchUnreadCounts()
        }}
        onOpenPostRequest={() => setIsPostRequestOpen(true)}
        onSelectListing={(item) => setSelectedProduct(item)}
      />

      <PostRequestModal
        isOpen={isPostRequestOpen}
        onClose={() => setIsPostRequestOpen(false)}
        categories={categories}
        colleges={colleges}
        onRequestCreated={() => {
          setIsWantedRequestsOpen(true)
          fetchUnreadCounts()
        }}
      />

      <SustainabilityModal
        isOpen={isSustainabilityOpen}
        onClose={() => setIsSustainabilityOpen(false)}
      />

      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => {
          setIsNotificationsOpen(false)
          fetchUnreadCounts()
        }}
        onNavigate={handleNotificationNavigate}
        onUnreadCountChange={(count) => setUnreadNotificationsCount(count)}
      />

      <MessagesModal
        isOpen={isMessagesOpen}
        onClose={() => {
          setIsMessagesOpen(false)
          setActiveConversationId(null)
          fetchUnreadCounts()
        }}
        activeConversationId={activeConversationId}
        onUnreadChange={fetchUnreadCounts}
        onNavigateContext={(type, id) => {
          setIsMessagesOpen(false)
          if (type === 'listing') {
            const found = listings.find(l => l.id === id)
            if (found) setSelectedProduct(found)
          } else if (type === 'booking') {
            setIsMyBookingsOpen(true)
          } else if (type === 'wanted') {
            setIsWantedRequestsOpen(true)
          }
        }}
      />

      {/* Mobile Bottom Navigation Bar (< lg screens) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#FBF8F3]/95 backdrop-blur-md border-t border-stone-200/90 py-1.5 px-3 flex items-center justify-around lg:hidden shadow-lg safe-area-pb">
        <button
          type="button"
          onClick={() => {
            setActiveTab('Home')
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
            activeTab === 'Home' ? 'text-[#1B3B2B] font-bold' : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px]">Home</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('Browse')
            window.scrollTo({ top: 120, behavior: 'smooth' })
          }}
          className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
            activeTab === 'Browse' ? 'text-[#1B3B2B] font-bold' : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Search className="w-5 h-5" />
          <span className="text-[10px]">Browse</span>
        </button>

        {/* Standout Post Item CTA */}
        <button
          type="button"
          onClick={() => {
            if (!user) {
              openAuthModal('login')
            } else {
              setEditingListing(null)
              setIsPostItemOpen(true)
            }
          }}
          className="flex flex-col items-center justify-center -mt-5"
          title="Post an item to rent or lend"
        >
          <div className="w-12 h-12 rounded-full bg-[#1B3B2B] hover:bg-[#25503B] text-white flex items-center justify-center shadow-lg shadow-emerald-950/25 border-2 border-[#FBF8F3] transition-transform active:scale-95">
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </div>
          <span className="text-[10px] font-bold text-[#1B3B2B] mt-0.5">Post</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!user) {
              openAuthModal('login')
            } else {
              setIsMyBookingsOpen(true)
            }
          }}
          className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
            activeTab === 'My Bookings' ? 'text-[#1B3B2B] font-bold' : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[10px]">Rentals</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="flex flex-col items-center justify-center space-y-1 text-stone-500 hover:text-stone-800 transition-colors relative"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px]">Menu</span>
          {(unreadNotificationsCount > 0 || unreadMessagesCount > 0) && (
            <span className="absolute top-0 right-2 w-2 h-2 rounded-full bg-rose-500" />
          )}
        </button>
      </nav>
    </div>
  )
}

