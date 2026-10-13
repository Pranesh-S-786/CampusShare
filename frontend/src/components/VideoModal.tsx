import { X, Play, Sparkles } from 'lucide-react'

interface VideoModalProps {
  isOpen: boolean
  onClose: () => void
}

export function VideoModal({ isOpen, onClose }: VideoModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Mobile Drag Indicator Pill */}
        <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Play className="w-4 h-4 fill-emerald-800" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                Welcome to CampusShare
              </h3>
              <p className="text-[11px] text-stone-500">
                The Student-to-Student Campus Marketplace
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video simulation / Interactive demo viewer */}
        <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center bg-stone-50">
          <div className="w-20 h-20 rounded-full bg-emerald-800 text-white flex items-center justify-center shadow-lg shadow-emerald-900/20 mb-6 animate-pulse-subtle">
            <Sparkles className="w-8 h-8" />
          </div>

          <h4 className="text-lg font-bold text-stone-900 mb-2">
            Campus Ecosystem Walkthrough
          </h4>
          <p className="text-xs sm:text-sm text-stone-600 max-w-md leading-relaxed mb-6">
            CampusShare brings college peers together to lend, borrow, rent, and buy items within your secure university bubble &mdash; reducing costs and campus waste.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-full text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 transition-colors cursor-pointer"
          >
            Close Walkthrough
          </button>
        </div>
      </div>
    </div>
  )
}
