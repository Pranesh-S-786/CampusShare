import { useState, useEffect } from 'react'
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Layers,
} from 'lucide-react'
import { Navbar } from './components/Navbar'
import { HeroSection } from './components/HeroSection'
import { BenefitsSection } from './components/BenefitsSection'
import { CategoriesSection } from './components/CategoriesSection'
import { HowItWorksSection } from './components/HowItWorksSection'
import { Footer } from './components/Footer'
import { MarketplaceModal } from './components/MarketplaceModal'
import { AuthModal } from './components/AuthModal'
import { VideoModal } from './components/VideoModal'
import { MarketplaceDashboard } from './components/marketplace/MarketplaceDashboard'
import { checkBackendHealth, type HealthResponse } from './services/api'
import { useAuth } from './context/AuthContext'

export default function App() {
  const { openAuthModal } = useAuth()

  // View routing ('landing' vs 'marketplace')
  const [currentView, setCurrentView] = useState<'landing' | 'marketplace'>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname
      const params = new URLSearchParams(window.location.search)
      if (path === '/marketplace' || params.get('view') === 'marketplace') {
        return 'marketplace'
      }
    }
    return 'landing'
  })

  // Modal & category states
  const [isMarketplaceOpen, setIsMarketplaceOpen] = useState(false)
  const [marketplaceCategory, setMarketplaceCategory] = useState('all')
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)

  // Stage 1 System Status indicator
  const [showStatusPanel, setShowStatusPanel] = useState(false)
  const [backendHealth, setBackendHealth] = useState<HealthResponse | null>(null)
  const [loadingHealth, setLoadingHealth] = useState(false)
  const [healthError, setHealthError] = useState<string | null>(null)

  const verifyBackend = async () => {
    setLoadingHealth(true)
    setHealthError(null)
    try {
      const data = await checkBackendHealth()
      setBackendHealth(data)
    } catch (err: unknown) {
      setHealthError(err instanceof Error ? err.message : 'Unable to connect to backend service')
      setBackendHealth(null)
    } finally {
      setLoadingHealth(false)
    }
  }

  // Sync with browser history
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname
      const params = new URLSearchParams(window.location.search)
      if (path === '/marketplace' || params.get('view') === 'marketplace') {
        setCurrentView('marketplace')
      } else {
        setCurrentView('landing')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    let ignore = false
    checkBackendHealth()
      .then((data) => {
        if (!ignore) {
          setBackendHealth(data)
          setHealthError(null)
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setHealthError(err instanceof Error ? err.message : 'Unable to reach backend')
          setBackendHealth(null)
        }
      })

    return () => {
      ignore = true
    }
  }, [])

  const navigateToMarketplace = (categoryName: string = 'all') => {
    setMarketplaceCategory(categoryName.toLowerCase())
    setCurrentView('marketplace')
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/marketplace')
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const navigateToLanding = () => {
    setCurrentView('landing')
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/')
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSelectCategory = (categoryName: string) => {
    navigateToMarketplace(categoryName)
  }

  const handleScrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // If on Marketplace view, render MarketplaceDashboard
  if (currentView === 'marketplace') {
    return (
      <div className="min-h-screen bg-[#FBF8F3] text-[#191F1A] flex flex-col font-sans">
        <MarketplaceDashboard
          onGoToLanding={navigateToLanding}
          initialCategory={marketplaceCategory}
        />
        <AuthModal />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FBF8F3] text-[#191F1A] flex flex-col font-sans selection:bg-emerald-200 selection:text-emerald-900">
      {/* Top Navigation */}
      <Navbar
        onOpenMarketplace={() => navigateToMarketplace('all')}
        onOpenAuth={(mode) => openAuthModal(mode)}
        onScrollToSection={handleScrollToSection}
      />

      {/* Main Page Content */}
      <main className="flex-1">
        {/* 1. Hero Section with 3D product arrangement and Category Dock */}
        <HeroSection
          onOpenMarketplace={() => navigateToMarketplace('all')}
          onOpenVideo={() => setIsVideoModalOpen(true)}
          onSelectCategory={handleSelectCategory}
          onScrollToBenefits={() => handleScrollToSection('benefits')}
        />

        {/* 2. Benefits: Verified Campus, Affordable Access, Resource Reuse */}
        <BenefitsSection />

        {/* 3. Categories: Books, Electronics, Lab Equipment, Sports, Furniture, Accessories, More */}
        <CategoriesSection onSelectCategory={handleSelectCategory} />

        {/* 4. How It Works Section */}
        <HowItWorksSection />
      </main>

      {/* Footer */}
      <Footer
        onOpenMarketplace={() => navigateToMarketplace('all')}
        onOpenAuth={(mode) => openAuthModal(mode)}
        onScrollToSection={handleScrollToSection}
      />

      {/* Modals & Dialogs */}
      <MarketplaceModal
        isOpen={isMarketplaceOpen}
        onClose={() => setIsMarketplaceOpen(false)}
        initialCategory={marketplaceCategory}
      />

      <AuthModal />

      <VideoModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
      />

      {/* Floating System Health Status Pill (Stage 1 Diagnostic Indicator) */}
      <div className="fixed bottom-4 left-4 z-40">
        {!showStatusPanel ? (
          <button
            type="button"
            onClick={() => setShowStatusPanel(true)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white/90 hover:bg-white text-stone-700 hover:text-stone-900 border border-stone-200/90 shadow-md backdrop-blur-md text-[11px] font-medium transition-all cursor-pointer"
            title="View backend and Supabase database connection health"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                backendHealth?.database?.includes('connected')
                  ? 'bg-emerald-500'
                  : 'bg-amber-500'
              }`}
            />
            <span className="font-mono text-stone-600">
              {backendHealth ? 'Supabase Connected' : 'System Health'}
            </span>
          </button>
        ) : (
          <div className="w-80 rounded-2xl bg-white border border-stone-200 shadow-2xl p-4 text-xs animate-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-100">
              <div className="flex items-center space-x-2 font-bold text-stone-800">
                <Layers className="w-4 h-4 text-emerald-700" />
                <span>Backend & Database Status</span>
              </div>
              <button
                type="button"
                onClick={() => setShowStatusPanel(false)}
                className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 py-1 text-stone-600">
              <div className="flex justify-between items-center">
                <span>API Service:</span>
                <span className="font-semibold text-stone-900">
                  {backendHealth?.service || 'CampusShare API'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Database:</span>
                <span className="inline-flex items-center font-mono font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                  {backendHealth?.database ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                      {backendHealth.database}
                    </>
                  ) : healthError ? (
                    <>
                      <AlertCircle className="w-3 h-3 mr-1 text-amber-600" />
                      Offline
                    </>
                  ) : (
                    'Checking...'
                  )}
                </span>
              </div>
            </div>

            <div className="pt-3 mt-2 border-t border-stone-100 flex items-center justify-between">
              <span className="text-[10px] text-stone-400 font-mono">Stage 1 + Stage 2</span>
              <button
                type="button"
                onClick={verifyBackend}
                disabled={loadingHealth}
                className="px-2.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-medium inline-flex items-center cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${loadingHealth ? 'animate-spin' : ''}`} />
                Check
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
