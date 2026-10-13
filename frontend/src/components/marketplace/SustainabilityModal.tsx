import { X, Leaf, Recycle, TreePine } from 'lucide-react'
import clocktowerImg from '../../assets/sustainability_clocktower.jpg'

interface SustainabilityModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SustainabilityModal({ isOpen, onClose }: SustainabilityModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white border border-stone-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 max-h-[92vh] sm:max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        <div className="relative h-36 sm:h-44 overflow-hidden bg-emerald-950 shrink-0">
          <img
            src={clocktowerImg}
            alt="Collegiate campus architecture"
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-4 left-6 right-6 text-white space-y-1">
            <div className="flex items-center space-x-2 text-emerald-300 text-xs font-bold font-mono uppercase tracking-wider">
              <Leaf className="w-3.5 h-3.5" />
              <span>Campus Sustainability</span>
            </div>
            <h3 className="text-xl font-bold leading-tight">
              Students sharing today for a better tomorrow.
            </h3>
          </div>
        </div>

        <div className="p-6 space-y-4 text-xs text-stone-600 leading-relaxed">
          <p>
            CampusShare transforms universities into vibrant circular micro-economies. Instead of buying single-use textbooks, lab coats, and electronics that get discarded after one semester, students can lend, borrow, and reuse gear right on their campus.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 space-y-1">
              <Recycle className="w-5 h-5 text-emerald-700" />
              <h4 className="font-bold text-stone-900 text-xs">Zero Waste Campus</h4>
              <p className="text-[11px] text-stone-600">Extending gear lifecycle across multiple student batches.</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 space-y-1">
              <TreePine className="w-5 h-5 text-emerald-700" />
              <h4 className="font-bold text-stone-900 text-xs">Reduced Footprint</h4>
              <p className="text-[11px] text-stone-600">Zero shipping emissions with direct on-campus handoffs.</p>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-sm transition-all"
            >
              Continue to Marketplace
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
