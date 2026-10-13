import {
  Plus,
  FileText,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Calendar,
  Tag,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

interface MarketplaceRightSidebarProps {
  onOpenPostItem: () => void
  onOpenPostRequest: () => void
  onViewBookings: () => void
  onViewRequests: () => void
  onOpenMyListings?: () => void
  onOpenIncomingRequests?: () => void
}

export function MarketplaceRightSidebar({
  onOpenPostItem,
  onOpenPostRequest,
  onViewBookings,
  onViewRequests,
  onOpenMyListings,
  onOpenIncomingRequests,
}: MarketplaceRightSidebarProps) {

  const { user, openAuthModal } = useAuth()

  const userInitial = user?.full_name?.charAt(0).toUpperCase() || user?.username?.charAt(0).toUpperCase() || 'S'
  const firstName = user?.full_name ? user.full_name.split(' ')[0] : user?.username || 'Student'

  return (
    <aside className="w-72 xl:w-80 flex flex-col space-y-5 h-full bg-[#FBF8F3] border-r xl:border-r-0 border-l border-stone-200/80 p-4 sm:p-5 select-none overflow-y-auto">
      {/* 1. User Profile Card matching reference */}
      <div
        onClick={() => {
          if (user) {
            openAuthModal('profile-view')
          } else {
            openAuthModal('login')
          }
        }}
        className="p-3.5 rounded-2xl bg-white border border-stone-200/90 shadow-2xs hover:shadow-xs transition-all cursor-pointer group flex items-center justify-between"
      >
        <div className="flex items-center space-x-3 min-w-0">
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.full_name || user.username}
              className="w-11 h-11 rounded-full object-cover border border-emerald-600/30 shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-[#1B3B2B] text-amber-100 flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
              {userInitial}
            </div>
          )}

          <div className="min-w-0">
            <h4 className="text-xs font-bold text-stone-900 truncate">
              {user ? `Hello, ${firstName}!` : 'Welcome, Guest!'}
            </h4>
            <p className="text-[11px] text-stone-500 truncate">
              {user ? (
                <>
                  {user.college?.short_code || user.display_college || 'Student'}
                  {user.grad_year ? ` • ${user.grad_year} Batch` : ''}
                </>
              ) : (
                'Sign in to share & borrow'
              )}
            </p>
            {user && (
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                {user.is_college_verified ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                    <ShieldCheck className="w-3 h-3 mr-1 text-emerald-700" />
                    Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    <AlertCircle className="w-3 h-3 mr-1 text-amber-600" />
                    Unverified
                  </span>
                )}
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                  🛡️ {user.trust_score ?? 75}
                </span>
              </div>
            )}
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all shrink-0" />
      </div>

      {/* 2. Action Buttons matching reference */}
      <div className="space-y-2.5">
        {/* Post an Item (Solid Forest Green) */}
        <button
          type="button"
          onClick={onOpenPostItem}
          className="w-full py-3 px-4 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-md shadow-emerald-950/15 transition-all hover:scale-101 flex items-center justify-center space-x-2 cursor-pointer group"
        >
          <Plus className="w-4 h-4" />
          <span>Post an Item</span>
        </button>

        {/* Post a Request (Light Mint/Stone) */}
        <button
          type="button"
          onClick={onOpenPostRequest}
          className="w-full py-2.5 px-4 rounded-full text-xs font-bold text-emerald-900 bg-[#EAF1EB] hover:bg-[#DCE7DD] border border-emerald-900/10 shadow-2xs transition-all hover:scale-101 flex items-center justify-center space-x-2 cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5 text-emerald-800" />
          <span>Post a Request</span>
        </button>

        {/* Manage My Listings */}
        {user && onOpenMyListings && (
          <button
            type="button"
            onClick={onOpenMyListings}
            className="w-full py-2.5 px-4 rounded-full text-xs font-bold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 shadow-2xs transition-all hover:scale-101 flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Tag className="w-3.5 h-3.5 text-emerald-800" />
            <span>Manage My Listings</span>
          </button>
        )}

        {/* Incoming Owner Requests */}
        {user && onOpenIncomingRequests && (
          <button
            type="button"
            onClick={onOpenIncomingRequests}
            className="w-full py-2.5 px-4 rounded-full text-xs font-bold text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 shadow-2xs transition-all hover:scale-101 flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-800" />
            <span>Review Incoming Requests</span>
          </button>
        )}
      </div>

      {/* 3. My Bookings Widget */}
      <div className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-stone-900">My Bookings</h4>
          <button
            type="button"
            onClick={onViewBookings}
            className="text-[11px] font-semibold text-emerald-800 hover:underline flex items-center cursor-pointer"
          >
            <span>View all</span>
            <ChevronRight className="w-3 h-3 ml-0.5" />
          </button>
        </div>

        <div
          onClick={onViewBookings}
          className="p-3.5 rounded-xl bg-stone-50 hover:bg-stone-100/70 border border-stone-200 text-center space-y-1.5 cursor-pointer transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto">
            <Calendar className="w-4 h-4" />
          </div>
          <p className="text-xs font-semibold text-stone-700">Track Item Bookings</p>
          <p className="text-[10px] text-stone-500 leading-relaxed">
            View pending approvals, confirmed rentals, and agreed pricing snapshots.
          </p>
        </div>
      </div>

      {/* 4. Recent Requests Widget */}
      <div className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-stone-900">Wanted Items Board</h4>
          <button
            type="button"
            onClick={onViewRequests}
            className="text-[11px] font-semibold text-emerald-800 hover:underline flex items-center cursor-pointer"
          >
            <span>View all</span>
            <ChevronRight className="w-3 h-3 ml-0.5" />
          </button>
        </div>

        <div
          onClick={onViewRequests}
          className="p-3.5 rounded-xl bg-stone-50 hover:bg-stone-100/70 border border-stone-200 text-center space-y-1.5 cursor-pointer transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto">
            <FileText className="w-4 h-4" />
          </div>
          <p className="text-xs font-semibold text-stone-700">Campus Wanted Items</p>
          <p className="text-[10px] text-stone-500 leading-relaxed">
            Browse requests from peers, offer gear you own, or request items needed.
          </p>
        </div>
      </div>
    </aside>
  )
}
