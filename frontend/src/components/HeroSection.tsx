import { useState, useRef, useEffect, type MouseEvent } from 'react'
import {
  ArrowRight,
  Play,
  ChevronDown,
  Book,
  Laptop,
  FlaskConical,
  Dumbbell,
  Armchair,
  Package,
  BookOpen,
  ShoppingCart,
  Calendar,
  Sparkles,
} from 'lucide-react'
import heroSceneImage from '../assets/campus_hero_3d_clean.jpg'
import { Product3DScene } from './Product3DScene'
import { CategoryDock } from './CategoryDock'
import StrokeText from './StrokeText'

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

  // Smooth realistic 3D perspective tilt across desktop composition
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
      className="relative w-full overflow-hidden"
    >
      {/* ======================================================== */}
      {/* 1. DEDICATED MOBILE HERO SECTION (Strictly matching reference screenshot) */}
      {/* ======================================================== */}
      <div className="block lg:hidden w-full px-4 pt-4 pb-3">
        {/* Eyebrow Label matching reference */}
        <div className="flex items-center justify-center space-x-2 mb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-500 font-mono text-center">
            For Students &bull; By Students
          </span>
        </div>

        {/* Main Headline matching reference */}
        <h1 className="text-[32px] xs:text-[36px] font-black tracking-tight text-stone-900 leading-[1.12] text-center">
          Same Campus.
          <br />
          <span className="inline-flex items-center justify-center gap-2">
            <span>More</span>
            <StrokeText
              text="Possibilities."
              strokeColor="#1B3B2B"
              fillColor="#2C6E49"
              strokeWidth={1.8}
              drawDuration={1.5}
              fillDelay={0.2}
              stagger={0.04}
              ease="power2.out"
              trigger="mount"
              fillMode="wipe"
              fontSize={36}
              fontWeight={800}
              letterSpacing={-1}
            />
          </span>
        </h1>

        {/* Subtitle matching reference */}
        <p className="text-[14px] xs:text-[15px] text-stone-600 leading-snug text-center max-w-[320px] xs:max-w-sm mx-auto pt-2 font-normal">
          Borrow, lend, rent or buy textbooks, gadgets, lab equipment, sports gear and more from students around your campus.
        </p>

        {/* Action CTAs (Explore Items & Watch Video) */}
        <div className="flex flex-col items-center gap-2.5 w-full max-w-[330px] xs:max-w-sm mx-auto pt-3.5">
          {/* Explore Items Pill */}
          <button
            type="button"
            onClick={onOpenMarketplace}
            className="w-full py-3.5 px-6 rounded-full text-sm font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-md shadow-emerald-950/20 flex items-center justify-center space-x-2 transition-all active:scale-98 cursor-pointer"
          >
            <span>Explore Items</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>

          {/* Watch Video Pill */}
          <button
            type="button"
            onClick={onOpenVideo}
            className="w-full py-3 px-6 rounded-full text-sm font-bold text-stone-900 bg-[#EFECE6]/95 hover:bg-white border border-stone-200/90 shadow-2xs flex items-center justify-center space-x-2.5 transition-all active:scale-98 cursor-pointer"
          >
            <span className="w-5 h-5 rounded-full bg-stone-900 text-white flex items-center justify-center shadow-xs">
              <Play className="w-2.5 h-2.5 fill-white ml-0.5" />
            </span>
            <span>Watch Video</span>
          </button>
        </div>

        {/* 3D Composition with Floating Gear & Action Badges */}
        <div className="relative w-full aspect-[4/3] xs:aspect-[1/1] max-w-[420px] mx-auto mt-2 select-none overflow-hidden">
          <img
            src={heroSceneImage}
            alt="CampusShare campus scene with floating backpack, laptop, headphones, camera, and textbooks"
            className="w-full h-full object-cover object-center"
          />

          {/* Ambient warm sun flare glow */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-amber-200/30 rounded-full blur-2xl pointer-events-none" />

          {/* Floating Action Badge 1: Lend (Emerald / Teal above laptop) */}
          <div
            onClick={() => onSelectCategory('Lend')}
            className="absolute top-[16%] left-[21%] z-20 cursor-pointer active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-600/95 text-white text-[11px] xs:text-xs font-bold shadow-lg shadow-emerald-950/20 border border-white/40 backdrop-blur-xs">
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                <Package className="w-2.5 h-2.5 text-white" />
              </span>
              <span>Lend</span>
            </div>
          </div>

          {/* Floating Action Badge 2: Borrow (Orange above headphones) */}
          <div
            onClick={() => onSelectCategory('Borrow')}
            className="absolute top-[17%] right-[16%] z-20 cursor-pointer active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#E08A38]/95 text-white text-[11px] xs:text-xs font-bold shadow-lg shadow-amber-950/20 border border-white/40 backdrop-blur-xs">
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                <BookOpen className="w-2.5 h-2.5 text-white" />
              </span>
              <span>Borrow</span>
            </div>
          </div>

          {/* Floating Action Badge 3: Buy (Purple beside DSLR camera) */}
          <div
            onClick={() => onSelectCategory('Buy')}
            className="absolute bottom-[35%] left-[8%] z-20 cursor-pointer active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#7064D1]/95 text-white text-[11px] xs:text-xs font-bold shadow-lg shadow-indigo-950/20 border border-white/40 backdrop-blur-xs">
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                <ShoppingCart className="w-2.5 h-2.5 text-white" />
              </span>
              <span>Buy</span>
            </div>
          </div>

          {/* Floating Action Badge 4: Rent (Coral beside textbooks) */}
          <div
            onClick={() => onSelectCategory('Rent')}
            className="absolute bottom-[31%] right-[6%] z-20 cursor-pointer active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#E24D5B]/95 text-white text-[11px] xs:text-xs font-bold shadow-lg shadow-rose-950/20 border border-white/40 backdrop-blur-xs">
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                <Calendar className="w-2.5 h-2.5 text-white" />
              </span>
              <span>Rent</span>
            </div>
          </div>

          {/* Ambient Sparkle */}
          <div className="absolute top-[22%] left-[48%] text-amber-300 pointer-events-none animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Floating Category Dock Card on Mobile */}
        <div className="w-full px-1 -mt-8 xs:-mt-10 relative z-30 max-w-[420px] mx-auto">
          <div className="rounded-3xl bg-white/95 backdrop-blur-md border border-white/90 shadow-xl p-2 xs:p-2.5 grid grid-cols-5 gap-1.5 text-center">
            {/* Books */}
            <button
              type="button"
              onClick={() => onSelectCategory('Books')}
              className="flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl bg-[#EEEDFC] hover:bg-[#E4E2FB] active:scale-95 transition-all cursor-pointer border border-transparent"
            >
              <div className="w-7 h-7 flex items-center justify-center text-[#6E64CC] mb-1">
                <Book className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-stone-800">Books</span>
            </button>

            {/* Electronics */}
            <button
              type="button"
              onClick={() => onSelectCategory('Electronics')}
              className="flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl bg-[#E7F5FD] hover:bg-[#DBF0FC] active:scale-95 transition-all cursor-pointer border border-transparent"
            >
              <div className="w-7 h-7 flex items-center justify-center text-[#2EAADC] mb-1">
                <Laptop className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-stone-800">Electronics</span>
            </button>

            {/* Lab Equipment */}
            <button
              type="button"
              onClick={() => onSelectCategory('Lab Equipment')}
              className="flex flex-col items-center justify-center py-2.5 px-0.5 rounded-2xl bg-[#E8F8EE] hover:bg-[#DCF4E4] active:scale-95 transition-all cursor-pointer border border-transparent"
            >
              <div className="w-7 h-7 flex items-center justify-center text-[#2BA365] mb-1">
                <FlaskConical className="w-5 h-5" />
              </div>
              <span className="text-[10px] leading-tight font-bold text-stone-800">
                Lab<br />Equipment
              </span>
            </button>

            {/* Sports */}
            <button
              type="button"
              onClick={() => onSelectCategory('Sports')}
              className="flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl bg-[#FEF1E6] hover:bg-[#FDE7D4] active:scale-95 transition-all cursor-pointer border border-transparent"
            >
              <div className="w-7 h-7 flex items-center justify-center text-[#E57A28] mb-1">
                <Dumbbell className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-stone-800">Sports</span>
            </button>

            {/* More */}
            <button
              type="button"
              onClick={() => onSelectCategory('all')}
              className="flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl bg-[#FEECEF] hover:bg-[#FCDDE2] active:scale-95 transition-all cursor-pointer border border-transparent"
            >
              <div className="w-7 h-7 flex items-center justify-center text-[#E04868] mb-1">
                <Armchair className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-stone-800">More</span>
            </button>
          </div>
        </div>

        {/* Scroll To Explore Indicator on Mobile */}
        <div className="flex items-center justify-center space-x-2.5 py-4 select-none">
          <div className="h-px bg-stone-300/60 w-12 xs:w-16" />
          <button
            type="button"
            onClick={onScrollToBenefits}
            className="w-6 h-6 rounded-full border border-stone-300/80 bg-white/70 flex items-center justify-center text-stone-500 hover:text-stone-800 shadow-2xs transition-colors cursor-pointer"
            aria-label="Scroll to explore"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-stone-500 font-medium">Scroll to explore</span>
          <div className="h-px bg-stone-300/60 w-12 xs:w-16" />
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. DESKTOP HERO SECTION (Wide screens >= lg) */}
      {/* ======================================================== */}
      <div className="hidden lg:block relative w-full -mt-16 sm:-mt-20 pt-16 sm:pt-20 pb-4 sm:pb-8">
        {/* Full-Width Continuous Background Artwork & Interactive 3D Badges */}
        <Product3DScene
          onSelectActionBadge={(badge) => onSelectCategory(badge)}
          externalRotateX={rotateX}
          externalRotateY={rotateY}
          externalIsHovered={isHovered}
        />

        {/* Semantic HTML UI Content Layered Above Artwork */}
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
                  <span className="inline-flex items-center gap-3">
                    <span>More</span>
                    <StrokeText
                      text="Possibilities."
                      strokeColor="#1B3B2B"
                      fillColor="#2C6E49"
                      strokeWidth={1.8}
                      drawDuration={1.5}
                      fillDelay={0.2}
                      stagger={0.04}
                      ease="power2.out"
                      trigger="mount"
                      fillMode="wipe"
                      fontSize={54}
                      fontWeight={800}
                      letterSpacing={-1}
                    />
                  </span>
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
      </div>
    </section>
  )
}
