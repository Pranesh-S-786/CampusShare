import { useState, useRef, useEffect } from 'react'
import {
  Search,
  ArrowRight,
  User as UserIcon,
  LogOut,
  ChevronDown,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { resolveMediaUrl } from '../services/api'

interface NavbarProps {
  onOpenMarketplace: () => void
  onOpenAuth: (mode: 'login' | 'signup') => void
  onScrollToSection: (sectionId: string) => void
}

export function Navbar({ onOpenMarketplace, onOpenAuth, onScrollToSection }: NavbarProps) {
  const { user, openAuthModal, logout } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('Home')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close user dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const navLinks = [
    { name: 'Home', action: () => { setActiveTab('Home'); window.scrollTo({ top: 0, behavior: 'smooth' }) } },
    { name: 'Browse', action: () => { setActiveTab('Browse'); onOpenMarketplace() } },
    { name: 'How it works', action: () => { setActiveTab('How it works'); onScrollToSection('how-it-works') } },
    { name: 'For Colleges', action: () => { setActiveTab('For Colleges'); onScrollToSection('benefits') } },
    { name: 'About', action: () => { setActiveTab('About'); onScrollToSection('about') } },
  ]

  const userInitial = user?.full_name?.charAt(0).toUpperCase() || user?.username?.charAt(0).toUpperCase() || 'S'

  return (
    <header className="sticky top-0 z-40 w-full pt-3 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center space-x-2.5 cursor-pointer group"
        >
          {/* Linked leaf / infinity icon matching reference image */}
          <div className="w-9 h-9 rounded-xl bg-emerald-700 flex items-center justify-center text-white shadow-md shadow-emerald-900/10 transition-transform group-hover:scale-105">
            <svg
              className="w-5 h-5 text-white"
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
          <span className="text-xl font-bold tracking-tight text-slate-900">
            Campus<span className="text-emerald-800">Share</span>
          </span>
        </div>

        {/* Center Pill Navigation (Desktop) */}
        <nav className="hidden lg:flex items-center space-x-1 px-3 py-1.5 rounded-full bg-white/70 backdrop-blur-md border border-slate-200/70 shadow-sm shadow-slate-200/40">
          {navLinks.map((link) => {
            const isActive = activeTab === link.name
            return (
              <button
                key={link.name}
                type="button"
                onClick={link.action}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#E5E1D8] text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/60'
                }`}
              >
                {link.name}
              </button>
            )
          })}
        </nav>

        {/* Right Action Buttons */}
        <div className="hidden lg:flex items-center space-x-3">
          {/* Search Trigger */}
          <button
            type="button"
            onClick={onOpenMarketplace}
            className="p-2.5 rounded-full bg-white/80 hover:bg-white text-stone-600 hover:text-stone-900 border border-slate-200/70 shadow-2xs transition-all cursor-pointer"
            title="Search campus marketplace"
            aria-label="Search items"
          >
            <Search className="w-4 h-4" />
          </button>

          {user ? (
            /* Authenticated Student Profile Pill & Dropdown */
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center space-x-2.5 pl-1.5 pr-3 py-1 rounded-full bg-white/90 hover:bg-white border border-stone-200/80 shadow-xs transition-all cursor-pointer group"
                id="user-profile-menu-button"
                aria-haspopup="true"
                aria-expanded={userMenuOpen}
              >
                {/* Profile Photo or Neutral Initials Avatar */}
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

                <div className="text-left">
                  <div className="text-xs font-bold text-stone-800 leading-tight max-w-[120px] truncate flex items-center gap-1">
                    <span>{user.full_name || user.username}</span>
                  </div>
                  <div className="text-[10px] font-medium flex items-center">
                    {user.is_college_verified ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1" />
                        <span className="truncate max-w-[90px] text-emerald-800">{user.display_college || 'Verified'}</span>
                      </>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        Unverified
                      </span>
                    )}
                  </div>
                </div>

                <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* User Dropdown Menu */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-stone-200 shadow-xl p-2 z-50 animate-in fade-in-50 zoom-in-95">
                  <div className="px-3 py-2 border-b border-stone-100 mb-1">
                    <p className="text-xs font-bold text-stone-900 truncate">
                      {user.full_name || user.username}
                    </p>
                    <p className="text-[11px] text-stone-500 truncate">{user.college_email}</p>
                    <div className="mt-1 flex items-center gap-1.5">
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
            <>
              {/* Log in Pill Button */}
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="px-4 py-2 rounded-full text-xs font-semibold text-stone-800 bg-white/80 hover:bg-white border border-slate-200/70 shadow-2xs transition-all cursor-pointer"
              >
                Log in
              </button>

              {/* Get Started Dark Forest Green Pill */}
              <button
                type="button"
                onClick={() => onOpenAuth('signup')}
                className="inline-flex items-center px-4 py-2 rounded-full text-xs font-semibold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-md shadow-emerald-950/20 transition-all hover:scale-102 cursor-pointer"
              >
                <span>Get Started</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </button>
            </>
          )}
        </div>

        {/* Mobile Header Right Controls matching reference screenshot */}
        <div className="flex lg:hidden items-center space-x-2">
          {/* Circular Search Trigger */}
          <button
            type="button"
            onClick={onOpenMarketplace}
            className="w-9 h-9 rounded-full bg-white/90 hover:bg-white text-stone-700 border border-slate-200/90 shadow-2xs flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Search items"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* User Profile Avatar with dropdown arrow */}
          {user ? (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex items-center space-x-1 pl-1 pr-1.5 py-1 rounded-full bg-white/95 hover:bg-white border border-stone-200/90 shadow-xs cursor-pointer transition-all"
              aria-label="User profile menu"
            >
              {user.avatar_url ? (
                <img
                  src={resolveMediaUrl(user.avatar_url)}
                  alt={user.full_name || user.username}
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.src = user.default_avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || user.username)}&background=1B3B2B&color=fff&size=200`
                  }}
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#1B3B2B] text-amber-100 flex items-center justify-center font-bold text-xs shadow-xs">
                  {userInitial}
                </div>
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-stone-500 transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold text-white bg-[#1B3B2B] shadow-xs cursor-pointer"
            >
              Log in
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-3 p-4 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200 shadow-xl space-y-3">
          {user && (
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/70 flex items-center space-x-3 mb-2">
              {user.avatar_url ? (
                <img
                  src={resolveMediaUrl(user.avatar_url)}
                  alt={user.full_name || user.username}
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.src = user.default_avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || user.username)}&background=1B3B2B&color=fff&size=200`
                  }}
                  className="w-9 h-9 rounded-full object-cover border border-emerald-600/30"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#1B3B2B] text-amber-100 flex items-center justify-center font-bold text-sm">
                  {userInitial}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-stone-900 truncate">
                  {user.full_name || user.username}
                </div>
                <div className="text-[11px] text-stone-500 truncate">{user.college_email}</div>
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  {user.is_college_verified ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center">
                      🎓 {user.display_college || 'Verified Student'}
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
            </div>
          )}

          <div className="flex flex-col space-y-1">
            {navLinks.map((link) => (
              <button
                key={link.name}
                type="button"
                onClick={() => {
                  link.action()
                  setMobileMenuOpen(false)
                }}
                className="text-left px-3 py-2 rounded-lg text-sm font-medium text-stone-800 hover:bg-stone-100"
              >
                {link.name}
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col space-y-2">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    openAuthModal('profile-view')
                    setMobileMenuOpen(false)
                  }}
                  className="w-full py-2.5 rounded-full text-xs font-semibold text-stone-800 bg-stone-100 text-center flex items-center justify-center"
                >
                  <UserIcon className="w-3.5 h-3.5 mr-2 text-emerald-800" />
                  <span>My Student Profile</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setMobileMenuOpen(false)
                    await logout()
                  }}
                  className="w-full py-2.5 rounded-full text-xs font-semibold text-rose-700 bg-rose-50 text-center flex items-center justify-center"
                >
                  <LogOut className="w-3.5 h-3.5 mr-2" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onOpenAuth('login')
                    setMobileMenuOpen(false)
                  }}
                  className="w-full py-2.5 rounded-full text-xs font-semibold text-stone-800 bg-stone-100 text-center"
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenAuth('signup')
                    setMobileMenuOpen(false)
                  }}
                  className="w-full py-2.5 rounded-full text-xs font-semibold text-white bg-emerald-800 text-center flex items-center justify-center"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
