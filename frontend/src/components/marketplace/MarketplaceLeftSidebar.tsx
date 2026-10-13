import {
  Home,
  Search,
  LayoutGrid,
  Calendar,
  Tag,
  FileText,
  MessageSquare,
  Bell,
  User as UserIcon,
  Plus,
  Building,
  ChevronDown,
  ArrowRight,
  Leaf,
  X,
} from 'lucide-react'
import { type College } from '../../services/api'
import sustainabilityImg from '../../assets/sustainability_clocktower.jpg'

export type NavTab =
  | 'Home'
  | 'Browse'
  | 'Categories'
  | 'My Bookings'
  | 'My Listings'
  | 'Requests'
  | 'Messages'
  | 'Notifications'
  | 'Profile'

interface MarketplaceLeftSidebarProps {
  activeTab: NavTab
  onSelectTab: (tab: NavTab) => void
  colleges: College[]
  selectedCollegeIds: number[]
  onToggleCollege: (collegeId: number) => void
  onSelectAllColleges: () => void
  onOpenSustainability: () => void
  onOpenAddCollege: () => void
  onGoToLanding: () => void
  onCloseMobile?: () => void
  unreadNotificationsCount?: number
  unreadMessagesCount?: number
}

export function MarketplaceLeftSidebar({
  activeTab,
  onSelectTab,
  colleges,
  selectedCollegeIds,
  onToggleCollege,
  onSelectAllColleges,
  onOpenSustainability,
  onOpenAddCollege,
  onGoToLanding,
  onCloseMobile,
  unreadNotificationsCount = 0,
  unreadMessagesCount = 0,
}: MarketplaceLeftSidebarProps) {
  const navItems = [
    { name: 'Home' as NavTab, icon: Home },
    { name: 'Browse' as NavTab, icon: Search },
    { name: 'Categories' as NavTab, icon: LayoutGrid },
    { name: 'My Bookings' as NavTab, icon: Calendar },
    { name: 'My Listings' as NavTab, icon: Tag },
    { name: 'Requests' as NavTab, icon: FileText },
    { name: 'Messages' as NavTab, icon: MessageSquare, badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined },
    { name: 'Notifications' as NavTab, icon: Bell, badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined },
    { name: 'Profile' as NavTab, icon: UserIcon },
  ]

  return (
    <aside className="w-64 xl:w-72 flex flex-col justify-between h-full bg-[#FBF8F3] border-r border-stone-200/80 p-4 sm:p-5 select-none overflow-y-auto">
      {/* Top: Logo & Main Navigation */}
      <div className="space-y-6">
        {/* Brand Logo Header */}
        <div className="flex items-center justify-between">
          <div
            onClick={onGoToLanding}
            className="flex items-center space-x-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-800 flex items-center justify-center text-white shadow-md shadow-emerald-950/10 transition-transform group-hover:scale-105">
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
            <span className="text-xl font-bold tracking-tight text-stone-900">
              Campus<span className="text-emerald-800">Share</span>
            </span>
          </div>

          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Items matching reference */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.name
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => {
                  onSelectTab(item.name)
                  if (onCloseMobile) onCloseMobile()
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#E8EFE9] text-[#1B3B2B] shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#1B3B2B]' : 'text-stone-500'}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white leading-none">
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* COLLEGES Section matching reference */}
        <div className="pt-2 border-t border-stone-200/70">
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 font-mono">
              Colleges
            </span>
            <button
              type="button"
              onClick={onOpenAddCollege}
              className="p-1 rounded-md text-stone-400 hover:text-stone-800 hover:bg-stone-200/50 transition-colors"
              title="Add or request a new college"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1">
            {colleges.slice(0, 5).map((col) => {
              const isSelected = selectedCollegeIds.includes(col.id)
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => onToggleCollege(col.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'bg-[#EAF1EB] text-[#1B3B2B] font-semibold border border-emerald-900/10'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/60 font-medium'
                  }`}
                  title={col.name}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <Building className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#1B3B2B]' : 'text-stone-400'}`} />
                    <span className="truncate">{col.name}</span>
                  </div>
                  {isSelected ? (
                    <ChevronDown className="w-3 h-3 text-[#1B3B2B] shrink-0" />
                  ) : null}
                </button>
              )
            })}

            {colleges.length > 5 && (
              <button
                type="button"
                onClick={onSelectAllColleges}
                className="w-full text-left px-3 py-1.5 text-[11px] text-emerald-800 hover:underline font-semibold"
              >
                {selectedCollegeIds.length === 0 ? '✓ Showing All Campuses' : 'Clear campus filters'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom: Subtle Sustainability Section matching reference */}
      <div className="pt-6">
        <div
          onClick={onOpenSustainability}
          className="relative rounded-2xl overflow-hidden p-4 border border-stone-200/80 shadow-xs cursor-pointer group transition-transform hover:-translate-y-0.5"
          style={{
            backgroundImage: `linear-gradient(to top, rgba(251, 248, 243, 0.95), rgba(251, 248, 243, 0.7)), url(${sustainabilityImg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="relative z-10 flex flex-col justify-between space-y-3">
            <div className="w-8 h-8 rounded-full bg-[#1B3B2B] text-emerald-200 flex items-center justify-center shadow-xs">
              <Leaf className="w-4 h-4" />
            </div>

            <div>
              <p className="text-xs font-bold text-stone-900 leading-snug">
                Students sharing today for a better tomorrow.
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider font-mono">
                Sustainability
              </span>
              <div className="w-6 h-6 rounded-full bg-white text-stone-800 flex items-center justify-center shadow-xs group-hover:bg-[#1B3B2B] group-hover:text-white transition-colors">
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
