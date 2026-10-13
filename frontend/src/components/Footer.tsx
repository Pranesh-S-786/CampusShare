const CURRENT_YEAR = new Date().getFullYear()

interface FooterProps {
  onOpenMarketplace: () => void
  onOpenAuth: (mode: 'login' | 'signup') => void
  onScrollToSection: (sectionId: string) => void
}

export function Footer({ onOpenMarketplace, onOpenAuth, onScrollToSection }: FooterProps) {
  return (
    <footer id="about" className="border-t border-stone-200 bg-white/80 backdrop-blur-md pt-16 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-stone-100">
          {/* Column 1: Brand & Purpose */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-800 flex items-center justify-center text-white shadow-xs">
                <svg
                  className="w-4.5 h-4.5 text-white"
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
            <p className="text-sm text-stone-600 max-w-sm leading-relaxed">
              A student-to-student sharing marketplace where college peers lend, rent, borrow, sell, and request academic and campus items.
            </p>
            <div className="flex items-center space-x-2 pt-1 text-xs text-stone-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Stage 2 &bull; Landing Page UI Active</span>
            </div>
          </div>

          {/* Column 2: Navigation */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900 font-mono mb-4">
              Marketplace
            </h4>
            <ul className="space-y-2.5 text-xs text-stone-600">
              <li>
                <button
                  type="button"
                  onClick={onOpenMarketplace}
                  className="hover:text-emerald-800 transition-colors cursor-pointer"
                >
                  Explore Catalog
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onScrollToSection('categories')}
                  className="hover:text-emerald-800 transition-colors cursor-pointer"
                >
                  Course Textbooks
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onScrollToSection('categories')}
                  className="hover:text-emerald-800 transition-colors cursor-pointer"
                >
                  Lab & Tech Gear
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onScrollToSection('categories')}
                  className="hover:text-emerald-800 transition-colors cursor-pointer"
                >
                  Sports & Outdoor
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Platform & Trust */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900 font-mono mb-4">
              Community & Safety
            </h4>
            <ul className="space-y-2.5 text-xs text-stone-600">
              <li>
                <button
                  type="button"
                  onClick={() => onScrollToSection('benefits')}
                  className="hover:text-emerald-800 transition-colors cursor-pointer"
                >
                  Verified Student Access
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onScrollToSection('how-it-works')}
                  className="hover:text-emerald-800 transition-colors cursor-pointer"
                >
                  Safe Handoff Protocol
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenAuth('signup')}
                  className="hover:text-emerald-800 transition-colors cursor-pointer"
                >
                  Student Registration
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenAuth('login')}
                  className="hover:text-emerald-800 transition-colors cursor-pointer"
                >
                  Campus Sign-in
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-4">
          <p>
            &copy; {CURRENT_YEAR} CampusShare. Built for college communities.
          </p>
          <p className="text-stone-400">
            Powered by Django REST Framework &bull; Supabase PostgreSQL &bull; React & Three.js
          </p>
        </div>
      </div>
    </footer>
  )
}
