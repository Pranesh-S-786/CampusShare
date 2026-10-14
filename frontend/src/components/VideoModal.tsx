import { useState, useEffect } from 'react'
import { X, Play, Sparkles, Layers, RotateCw } from 'lucide-react'
import CircularCarousel, { type CarouselItem, type CarouselPreset } from './CircularCarousel'

import slide1 from '../assets/carousel/1_same_campus_more_possibilities.jpg'
import slide2 from '../assets/carousel/2_explore_everything_around_you.jpg'
import slide3 from '../assets/carousel/3_lend_with_ease.jpg'
import slide4 from '../assets/carousel/4_borrow_and_book_in_minutes.jpg'
import slide5 from '../assets/carousel/5_secure_handover_with_qr.jpg'
import slide6 from '../assets/carousel/6_smart_billing_and_settlement.jpg'
import slide7 from '../assets/carousel/7_trust_ratings_and_community.jpg'

interface VideoModalProps {
  isOpen: boolean
  onClose: () => void
}

const CAROUSEL_ITEMS: CarouselItem[] = [
  {
    src: slide1,
    alt: 'Same Campus. More Possibilities.',
    title: 'Same Campus. More Possibilities.',
    subtitle: 'Borrow, lend, rent or buy within your campus community'
  },
  {
    src: slide2,
    alt: 'Explore Everything Around You.',
    title: 'Explore Everything Around You.',
    subtitle: 'Textbooks, electronics, lab equipment & sports gear'
  },
  {
    src: slide3,
    alt: 'Lend with Ease.',
    title: 'Lend with Ease.',
    subtitle: 'Set daily/hourly rates, manage availability & verify'
  },
  {
    src: slide4,
    alt: 'Borrow & Book in Minutes.',
    title: 'Borrow & Book in Minutes.',
    subtitle: 'Find items nearby, request booking & get quick approvals'
  },
  {
    src: slide5,
    alt: 'Secure Handover with QR.',
    title: 'Secure Handover with QR.',
    subtitle: 'Verified pickup and return tracking with on-campus QR'
  },
  {
    src: slide6,
    alt: 'Smart Billing & Settlement.',
    title: 'Smart Billing & Settlement.',
    subtitle: 'Transparent hourly tracking, advance adjustments & fair refunds'
  },
  {
    src: slide7,
    alt: 'Trust, Ratings & Community.',
    title: 'Trust, Ratings & Community.',
    subtitle: 'Verified college credentials, mutual ratings & trusted student bubble'
  }
]

const PRESET_OPTIONS: { label: string; value: CarouselPreset }[] = [
  { label: 'Cylinder', value: 'cylinder' },
  { label: 'Orbit', value: 'orbit' },
  { label: 'Wheel', value: 'wheel' },
  { label: 'Panorama', value: 'panorama' }
]

export function VideoModal({ isOpen, onClose }: VideoModalProps) {
  const [preset, setPreset] = useState<CarouselPreset>('cylinder')
  const [cardWidth, setCardWidth] = useState(440)
  const [activeSlide, setActiveSlide] = useState(0)

  // Dynamically adapt cardWidth based on screen width
  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth
      if (width < 480) {
        setCardWidth(270)
      } else if (width < 768) {
        setCardWidth(340)
      } else if (width < 1200) {
        setCardWidth(420)
      } else {
        setCardWidth(460)
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative w-full max-w-5xl xl:max-w-6xl bg-[#0C1711] rounded-2xl sm:rounded-3xl shadow-2xl border border-emerald-900/40 overflow-hidden flex flex-col text-stone-100 max-h-[96vh]">
        {/* Subtle decorative glowing background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />

        {/* Mobile Drag Indicator Pill */}
        <div className="w-12 h-1.5 bg-stone-700 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Header Bar */}
        <div className="p-3.5 sm:p-5 border-b border-emerald-950/80 flex items-center justify-between relative z-10 bg-[#0C1711]/90 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-xs">
              <Play className="w-4 h-4 fill-emerald-400 ml-0.5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  CampusShare 3D Experience
                </h3>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-900/50 text-emerald-300 border border-emerald-700/40">
                  <Sparkles className="w-2.5 h-2.5 mr-1" />
                  Interactive Tour
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-stone-400">
                Drag or swipe to rotate &bull; Click any slide to bring it forward
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Preset Selector */}
            <div className="hidden md:flex items-center space-x-1 bg-stone-900/90 p-1 rounded-xl border border-stone-800">
              <Layers className="w-3.5 h-3.5 text-stone-400 ml-1.5 mr-1" />
              {PRESET_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPreset(opt.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    preset === opt.value
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-stone-400 hover:text-white hover:bg-stone-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Walkthrough"
              className="p-2 rounded-full text-stone-400 hover:text-white hover:bg-stone-800/80 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3D Circular Carousel Container */}
        {/* Adjusted to accommodate ~1.75 widescreen ratio cards (1024x584) */}
        <div className="relative w-full h-[460px] sm:h-[540px] md:h-[580px] bg-gradient-to-b from-[#0C1711] via-[#09120D] to-[#060D09] flex items-center justify-center overflow-hidden">
          <CircularCarousel
            items={CAROUSEL_ITEMS}
            preset={preset}
            intro="rise"
            cardWidth={cardWidth}
            aspectRatio={1024 / 584} // 1.753 matching original 1024x584 image dimensions
            gap={24}
            speed={12}
            momentum={0.65}
            snap
            draggable
            pauseOnHover
            focusOnClick
            captions
            depthFade={0.6}
            fadeColor="#060D09"
            cornerRadius={14}
            onChange={(idx) => setActiveSlide(idx)}
            className="w-full h-full"
          />

          {/* Quick preset switch pill for mobile */}
          <div className="absolute top-3 left-3 md:hidden z-20 flex items-center space-x-1 bg-stone-900/80 backdrop-blur-md px-2 py-1 rounded-full border border-stone-800 text-[11px] text-stone-300">
            <span className="text-stone-400">View:</span>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as CarouselPreset)}
              className="bg-transparent text-emerald-400 font-medium outline-none cursor-pointer"
            >
              {PRESET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-stone-900 text-stone-100">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Hint overlay pill */}
          <div className="absolute top-3 right-3 hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-stone-900/70 border border-stone-800 text-[11px] text-stone-400 backdrop-blur-md pointer-events-none">
            <RotateCw className="w-3 h-3 text-emerald-400 animate-spin" style={{ animationDuration: '6s' }} />
            <span>Slide {activeSlide + 1} of {CAROUSEL_ITEMS.length} &bull; Drag to rotate</span>
          </div>
        </div>

        {/* Footer info & action */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-t border-emerald-950/80 bg-[#0A140E] flex flex-wrap items-center justify-between gap-3 text-xs text-stone-400">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium text-stone-300">
              {CAROUSEL_ITEMS[activeSlide]?.title}
            </span>
          </div>

          <div className="flex items-center space-x-3 ml-auto">
            <span className="text-[11px] text-stone-500 hidden sm:inline">
              Use arrow keys or click & drag to explore
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-600 transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
