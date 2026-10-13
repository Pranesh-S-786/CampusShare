import { useState, useRef, useEffect, type MouseEvent } from 'react'
import { ArrowRight, Play } from 'lucide-react'
import { Product3DScene } from './Product3DScene'
import { CategoryDock } from './CategoryDock'

interface HeroSectionProps {
  onOpenMarketplace: () => void
  onOpenVideo: () => void
  onSelectCategory: (categoryName: string) => void
  onScrollToBenefits: () => void
}

export function HeroSection({
  onOpenMarketplace,
  onOpenVideo,
  onSelectCategory,
  onScrollToBenefits,
}: HeroSectionProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const [rotateX, setRotateX] = useState(0)
  const [rotateY, setRotateY] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Smooth realistic 3D perspective tilt across the entire hero composition
  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    if (prefersReducedMotion || !sectionRef.current) return
    const rect = sectionRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2

    const targetY = (x / (rect.width / 2)) * 3.0
    const targetX = -(y / (rect.height / 2)) * 3.0

    setRotateX(targetX)
    setRotateY(targetY)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setRotateX(0)
    setRotateY(0)
  }

  return (
    <section
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      className="relative w-full overflow-hidden -mt-16 sm:-mt-20 pt-16 sm:pt-20 pb-4 sm:pb-8"
    >
      {/* 1. Full-Width Continuous Background Artwork & Interactive 3D Badges */}
      <Product3DScene
        onSelectActionBadge={(badge) => onSelectCategory(badge)}
        externalRotateX={rotateX}
        externalRotateY={rotateY}
        externalIsHovered={isHovered}
      />

      {/* 2. Semantic HTML UI Content Layered Above Artwork */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-between min-h-[480px] sm:min-h-[540px] lg:min-h-[590px]">
        {/* Top/Middle Area: Left Headline & CTA Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-3 sm:pt-6">
          {/* Left Column: Headline and Call-To-Actions (positioned over sunlit cream atmosphere) */}
          <div className="lg:col-span-6 xl:col-span-5 flex flex-col justify-center space-y-5">
            {/* Eyebrow Label matching reference */}
            <div className="flex items-center space-x-2">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-stone-500 font-mono">
                For Students &bull; By Students
              </span>
            </div>

            {/* Main Headline strictly matching reference (2 lines) */}
            <div className="space-y-1">
              <h1 className="text-4xl sm:text-5xl xl:text-[54px] font-extrabold tracking-tight text-stone-900 leading-[1.12]">
                Same Campus.
                <br />
                More <span className="text-[#2C6E49]">Possibilities.</span>
              </h1>
            </div>

            {/* Supporting Copy matching reference */}
            <p className="text-base sm:text-[17px] text-stone-600 leading-relaxed max-w-lg font-normal">
              Borrow, lend, rent or buy textbooks, gadgets, lab equipment, sports gear and more from students around your campus.
            </p>

            {/* Action CTAs matching reference */}
            <div className="flex flex-wrap items-center gap-3.5 pt-1">
              {/* Primary: Explore Items Pill Button */}
              <button
                type="button"
                onClick={onOpenMarketplace}
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-full text-sm font-semibold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-lg shadow-emerald-950/15 transition-all hover:scale-102 cursor-pointer group"
              >
                <span>Explore Items</span>
                <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
              </button>

              {/* Secondary: Watch Video Pill Button */}
              <button
                type="button"
                onClick={onOpenVideo}
                className="inline-flex items-center justify-center px-5 py-3.5 rounded-full text-sm font-semibold text-stone-800 bg-[#F4F1EA] hover:bg-white border border-stone-200/80 shadow-xs transition-all hover:scale-102 cursor-pointer group"
              >
                <span className="w-6 h-6 rounded-full bg-stone-900 text-white flex items-center justify-center mr-2.5 shadow-xs group-hover:bg-[#1B3B2B] transition-colors">
                  <Play className="w-3 h-3 fill-white ml-0.5" />
                </span>
                <span>Watch Video</span>
              </button>
            </div>
          </div>

          {/* Right Column: Open space showcasing the 3D backpack, laptop, camera, and CIT campus architecture */}
          <div className="hidden lg:block lg:col-span-6 xl:col-span-7 h-[340px] pointer-events-none" />
        </div>

        {/* Floating Category Dock at Bottom of Hero matching reference */}
        <div className="mt-4 sm:mt-6">
          <CategoryDock
            onSelectCategory={onSelectCategory}
            onScrollDown={onScrollToBenefits}
          />
        </div>
      </div>
    </section>
  )
}

