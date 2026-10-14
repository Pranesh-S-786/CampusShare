import { useState, useRef, useEffect } from 'react'
import {
  Search,
  Heart,
  Bell,
  MessageSquare,
  ChevronDown,
  Building,
  User as UserIcon,
  LogOut,
  Menu,
} from 'lucide-react'
import { type College, resolveMediaUrl } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

interface MarketplaceTopBarProps {
  colleges: College[]
  selectedCollegeId: number | null
  onSelectCollege: (id: number | null) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  onToggleMobileMenu: () => void
  onOpenNotifications: () => void
  onOpenMessages?: () => void
  onOpenWishlist: () => void
  onGoToLanding: () => void
  unreadNotificationsCount?: number
  unreadMessagesCount?: number
}

export function MarketplaceTopBar({
  colleges,
  selectedCollegeId,
  onSelectCollege,
  searchQuery,
  onSearchChange,
  onToggleMobileMenu,
  onOpenNotifications,
  onOpenMessages,
  onOpenWishlist,
  onGoToLanding,
  unreadNotificationsCount = 0,
  unreadMessagesCount = 0,
}: MarketplaceTopBarProps) {
  const { user, openAuthModal, logout } = useAuth()
  const [collegeMenuOpen, setCollegeMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const collegeDropdownRef = useRef<HTMLDivElement>(null)
  const userDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (collegeDropdownRef.current && !collegeDropdownRef.current.contains(event.target as Node)) {
        setCollegeMenuOpen(false)
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const activeCollege = colleges.find((c) => c.id === selectedCollegeId)
  const userInitial = user?.full_name?.charAt(0).toUpperCase() || user?.username?.charAt(0).toUpperCase() || 'S'

  return (
    <header className="sticky top-0 z-30 w-full bg-[#FBF8F3]/95 backdrop-blur-md border-b border-stone-200/80 px-2.5 sm:px-6 py-2 sm:py-2.5">
      <div className="max-w-[1700px] mx-auto flex items-center justify-between gap-2 sm:gap-6">
        {/* Left: Mobile hamburger & Logo on small screens */}
        <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="lg:hidden p-1.5 sm:p-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
            aria-label="Toggle navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Brand Logo (Visible on mobile/tablet when sidebar is collapsed) */}
          <div
            onClick={onGoToLanding}
            className="flex lg:hidden items-center space-x-1.5 sm:space-x-2 cursor-pointer group"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-800 flex items-center justify-center text-white shadow-xs">
              <svg
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 17a5 5 0 0 0 7-7l-4-4a5 5 0 0 0-7 7l4 4" />
                <path d="M17 7a5 5 0 0 0-7 7l4 4a5 5 0 0 0 7-7l-4-4" />
              </svg>
            </div>
            <span className="text-sm sm:text-base font-bold text-stone-900 tracking-tight">
              Campus<span className="text-emerald-800">Share</span>
            </span>
          </div>

          {/* Top Bar College Selector Pill */}
          <div className="relative hidden sm:block" ref={collegeDropdownRef}>
            <button
              type="button"
              onClick={() => setCollegeMenuOpen(!collegeMenuOpen)}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-full bg-white border border-stone-200/90 shadow-2xs hover:bg-stone-50/80 text-xs font-semibold text-stone-800 transition-all cursor-pointer"
              title="Filter items by college"
            >
              <Building className="w-3.5 h-3.5 text-emerald-800" />
              <span className="max-w-[200px] truncate">
                {activeCollege ? activeCollege.name : 'All Campus Locations'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform ${collegeMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {collegeMenuOpen && (
              <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-white border border-stone-200 shadow-xl p-2 z-50 animate-in fade-in-50 zoom-in-95">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400 font-mono">
                  Select Discovery Campus
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSelectCollege(null)
                    setCollegeMenuOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    selectedCollegeId === null
                      ? 'bg-emerald-50 text-emerald-900 font-bold'
                      : 'text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  🌐 All Campuses (Cross-College Discovery)
                </button>
                <div className="my-1 border-t border-stone-100" />
                <div className="max-h-56 overflow-y-auto space-y-0.5">
                  {colleges.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => {
                        onSelectCollege(col.id)
                        setCollegeMenuOpen(false)
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-between ${
                        selectedCollegeId === col.id
                          ? 'bg-[#1B3B2B] text-white font-bold'
                          : 'text-stone-700 hover:bg-stone-100/70 font-medium'
                      }`}
                    >
                      <span className="truncate pr-2">{col.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        selectedCollegeId === col.id ? 'bg-emerald-900 text-amber-200' : 'bg-stone-100 text-stone-500'
                      }`}>
                        {col.short_code}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Search input matching reference */}
        <div className="flex-1 min-w-[120px] max-w-2xl">
          <div className="relative">
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400 absolute left-3 sm:left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search items, textbooks, gear..."
              className="w-full pl-8 sm:pl-11 pr-3 sm:pr-4 py-1.5 sm:py-2.5 rounded-full bg-white border border-stone-200/90 focus:border-[#1B3B2B] focus:ring-3 focus:ring-[#1B3B2B]/10 text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 outline-none transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 sm:right-3.5 top-1/2 -translate-y-1/2 text-[11px] sm:text-xs text-stone-400 hover:text-stone-700"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Right: Wishlist, Notifications & Account */}
        <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
          {/* Wishlist Heart Button (Hidden on small screens, accessible in sidebar & bottom nav) */}
          <button
            type="button"
            onClick={onOpenWishlist}
            className="hidden md:flex p-2.5 rounded-full bg-white hover:bg-stone-50 border border-stone-200/90 text-stone-700 hover:text-rose-600 shadow-2xs transition-all cursor-pointer relative"
            title="Saved items & wishlist"
            aria-label="Wishlist"
          >
            <Heart className="w-4 h-4" />
          </button>

          {/* Messages Button (Desktop/Tablet) */}
          {user && onOpenMessages && (
            <button
              type="button"
              onClick={onOpenMessages}
              className="hidden sm:flex p-2.5 rounded-full bg-white hover:bg-stone-50 border border-stone-200/90 text-stone-700 hover:text-[#1B3B2B] shadow-2xs transition-all cursor-pointer relative"
              title="Direct messages"
              aria-label="Messages"
            >
              <MessageSquare className="w-4 h-4" />
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-600 text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-white shadow-xs">
                  {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                </span>
              )}
            </button>
          )}

          {/* Notifications Bell */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className="p-2 sm:p-2.5 rounded-full bg-white hover:bg-stone-50 border border-stone-200/90 text-stone-700 hover:text-[#1B3B2B] shadow-2xs transition-all cursor-pointer relative"
            title="Campus notifications"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] sm:min-w-[18px] sm:h-[18px] px-1 rounded-full bg-rose-500 text-[9px] sm:text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-white shadow-xs">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* User Account / Profile */}
          {user ? (
            <div className="relative" ref={userDropdownRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center space-x-2 pl-1 pr-2 py-1 rounded-full bg-white hover:bg-stone-50 border border-stone-200/90 shadow-2xs transition-all cursor-pointer"
                aria-haspopup="true"
                aria-expanded={userMenuOpen}
              >
                {user.avatar_url ? (
                  <img
                    src={resolveMediaUrl(user.avatar_url)}
                    alt={user.full_name || user.username}
                    onError={(e) => {
                      e.currentTarget.onerror = null
                      e.currentTarget.src = user.default_avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || user.username)}&background=1B3B2B&color=fff&size=200`
                    }}
                    className="w-7 h-7 rounded-full object-cover border border-emerald-600/30"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#1B3B2B] text-amber-100 flex items-center justify-center font-bold text-xs shadow-xs">
                    {userInitial}
                  </div>
                )}
                <span className="hidden md:inline-block text-xs font-bold text-stone-800 max-w-[100px] truncate">
                  {user.full_name || user.username}
                </span>
                {user.is_college_verified ? (
                  <span className="hidden sm:inline-flex px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Verified
                  </span>
                ) : (
                  <span className="hidden sm:inline-flex px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    Unverified
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-stone-200 shadow-xl p-2 z-50 animate-in fade-in-50 zoom-in-95">
                  <div className="px-3 py-2 border-b border-stone-100 mb-1">
                    <p className="text-xs font-bold text-stone-900 truncate">
                      {user.full_name || user.username}
                    </p>
                    <p className="text-[11px] text-stone-500 truncate">{user.college_email}</p>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      {user.is_college_verified ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center">
                          🎓 Verified Student
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center">
                          ⚠️ Unverified
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                        🛡️ {user.trust_score ?? 75} Trust
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false)
                      openAuthModal('profile-view')
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-stone-700 hover:text-stone-900 hover:bg-stone-50 transition-colors cursor-pointer"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-emerald-800" />
                    <span>My Student Profile</span>
                  </button>

                  <button
                    type="button"
                    onClick={onGoToLanding}
                    className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors cursor-pointer"
                  >
                    <Building className="w-3.5 h-3.5 text-stone-400" />
                    <span>View Landing Page</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      setUserMenuOpen(false)
                      await logout()
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-700 hover:text-rose-900 hover:bg-rose-50 transition-colors cursor-pointer mt-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs font-semibold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-sm transition-all cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
