import { useState, useRef, useEffect, type MouseEvent } from 'react'
import heroSceneImage from '../assets/campus_hero_3d_clean.jpg'
import {
  RefreshCw,
  BookOpen,
  ShoppingCart,
  Calendar,
  Sparkles,
} from 'lucide-react'

interface Product3DSceneProps {
  onSelectActionBadge?: (action: string) => void
  externalRotateX?: number
  externalRotateY?: number
  externalIsHovered?: boolean
}

export function Product3DScene({
  onSelectActionBadge,
  externalRotateX,
  externalRotateY,
  externalIsHovered,
}: Product3DSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [internalRotateX, setInternalRotateX] = useState(0)
  const [internalRotateY, setInternalRotateY] = useState(0)
  const [internalIsHovered, setInternalIsHovered] = useState(false)
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

  const rotateX = externalRotateX !== undefined ? externalRotateX : internalRotateX
  const rotateY = externalRotateY !== undefined ? externalRotateY : internalRotateY
  const isHovered = externalIsHovered !== undefined ? externalIsHovered : internalIsHovered

  // Internal mouse move handler fallback
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2

    const targetY = (x / (rect.width / 2)) * 3
    const targetX = -(y / (rect.height / 2)) * 3

    setInternalRotateX(targetX)
    setInternalRotateY(targetY)
  }

  const handleMouseLeave = () => {
    setInternalIsHovered(false)
    setInternalRotateX(0)
    setInternalRotateY(0)
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setInternalIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      className="absolute inset-0 w-full h-full pointer-events-none select-none overflow-hidden"
    >
      {/* 1. CONTINUOUS FULL-WIDTH PHOTOREALISTIC BACKGROUND ARTWORK LAYER */}
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          maskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
        }}
      >
        <img
          src={heroSceneImage}
          alt="CampusShare sunlit campus environment with 3D backpack, laptop, headphones, camera, and textbooks"
          className="w-full h-full object-cover object-[center_top] select-none transition-transform duration-700 ease-out"
          style={{
            transform: prefersReducedMotion
              ? 'none'
              : `scale(${isHovered ? 1.015 : 1}) translate3d(${rotateY * -0.3}px, ${rotateX * 0.3}px, 0)`,
          }}
          loading="eager"
        />

        {/* Ambient Warm Sun Flare at top-right blending into warm cream sky */}
        <div className="absolute -top-16 -right-16 w-96 h-96 bg-amber-200/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 2. INTERACTIVE 3D FLOATING ACTION BADGES LAYER (Strictly Matching Reference Coordinates on Desktop) */}
      <div
        className="hidden lg:block relative w-full h-full max-w-7xl mx-auto pointer-events-none"
        style={{
          perspective: '1200px',
        }}
      >
        {/* 1. LEND BADGE (Top Center - Directly Above Laptop) */}
        <div
          onClick={() => onSelectActionBadge?.('Lend')}
          className="absolute top-[27%] sm:top-[26%] lg:top-[25%] left-[53%] -translate-x-1/2 z-20 cursor-pointer pointer-events-auto group transition-all duration-300"
          style={{
            transform: prefersReducedMotion
              ? 'none'
              : `translate3d(${rotateY * 2.2}px, ${rotateX * -1.8}px, 45px)`,
          }}
          title="Lend gear safely to college peers"
        >
          <div className="flex items-center space-x-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full bg-emerald-600/95 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-950/25 border border-white/30 backdrop-blur-md text-xs sm:text-[13px] font-bold transition-all duration-200 group-hover:scale-108 group-hover:-translate-y-1">
            <span className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center">
              <RefreshCw className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
            </span>
            <span>Lend</span>
          </div>
        </div>

        {/* 2. BORROW BADGE (Top Right - Above Textbooks & Headphones) */}
        <div
          onClick={() => onSelectActionBadge?.('Borrow')}
          className="absolute top-[28%] sm:top-[27%] lg:top-[25%] right-[8%] sm:right-[12%] lg:right-[16%] xl:right-[18%] z-20 cursor-pointer pointer-events-auto group transition-all duration-300"
          style={{
            transform: prefersReducedMotion
              ? 'none'
              : `translate3d(${rotateY * 1.8}px, ${rotateX * -1.5}px, 40px)`,
          }}
          title="Borrow items for exams, classes & projects"
        >
          <div className="flex items-center space-x-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full bg-[#E08A38]/95 hover:bg-[#E08A38] text-white shadow-xl shadow-amber-950/25 border border-white/30 backdrop-blur-md text-xs sm:text-[13px] font-bold transition-all duration-200 group-hover:scale-108 group-hover:-translate-y-1">
            <span className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center">
              <BookOpen className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
            </span>
            <span>Borrow</span>
          </div>
        </div>

        {/* 3. BUY BADGE (Middle Left - Beside DSLR Camera) */}
        <div
          onClick={() => onSelectActionBadge?.('Buy')}
          className="absolute top-[52%] sm:top-[51%] lg:top-[50%] left-[44%] sm:left-[43%] lg:left-[42%] -translate-x-1/2 z-20 cursor-pointer pointer-events-auto group transition-all duration-300"
          style={{
            transform: prefersReducedMotion
              ? 'none'
              : `translate3d(${rotateY * 2.6}px, ${rotateX * -2.0}px, 50px)`,
          }}
          title="Buy pre-owned items at student prices"
        >
          <div className="flex items-center space-x-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full bg-[#7064D1]/95 hover:bg-[#7064D1] text-white shadow-xl shadow-indigo-950/25 border border-white/30 backdrop-blur-md text-xs sm:text-[13px] font-bold transition-all duration-200 group-hover:scale-108 group-hover:-translate-y-1">
            <span className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center">
              <ShoppingCart className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
            </span>
            <span>Buy</span>
          </div>
        </div>

        {/* 4. RENT BADGE (Middle Right - Near Textbooks & Racket) */}
        <div
          onClick={() => onSelectActionBadge?.('Rent')}
          className="absolute top-[54%] sm:top-[53%] lg:top-[52%] right-[6%] sm:right-[10%] lg:right-[14%] xl:right-[16%] z-20 cursor-pointer pointer-events-auto group transition-all duration-300"
          style={{
            transform: prefersReducedMotion
              ? 'none'
              : `translate3d(${rotateY * 2.0}px, ${rotateX * -1.6}px, 42px)`,
          }}
          title="Rent items for a day, week, or semester"
        >
          <div className="flex items-center space-x-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full bg-[#E24D5B]/95 hover:bg-[#E24D5B] text-white shadow-xl shadow-rose-950/25 border border-white/30 backdrop-blur-md text-xs sm:text-[13px] font-bold transition-all duration-200 group-hover:scale-108 group-hover:-translate-y-1">
            <span className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center">
              <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
            </span>
            <span>Rent</span>
          </div>
        </div>

        {/* Floating Ambient Sparkles / Sun Dust */}
        <div className="absolute top-[26%] right-[32%] text-amber-300/70 pointer-events-none animate-pulse-subtle">
          <Sparkles className="w-4 h-4" />
        </div>
      </div>
    </div>
  )
}
