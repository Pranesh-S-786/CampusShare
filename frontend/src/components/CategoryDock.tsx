import {
  Book,
  Laptop,
  FlaskConical,
  Dumbbell,
  Armchair,
  Headphones,
  MoreHorizontal,
  ChevronDown,
} from 'lucide-react'

interface CategoryDockProps {
  onSelectCategory: (categoryName: string) => void
  onScrollDown: () => void
}

export function CategoryDock({ onSelectCategory, onScrollDown }: CategoryDockProps) {
  const categories = [
    {
      id: 'books',
      name: 'Books',
      icon: Book,
      bg: 'bg-[#EEEDFC] text-[#6E64CC] border-transparent',
      hover: 'hover:bg-[#E4E2FB]',
    },
    {
      id: 'electronics',
      name: 'Electronics',
      icon: Laptop,
      bg: 'bg-[#E7F5FD] text-[#2EAADC] border-transparent',
      hover: 'hover:bg-[#DBF0FC]',
    },
    {
      id: 'lab-equipment',
      name: 'Lab Equipment',
      icon: FlaskConical,
      bg: 'bg-[#E8F8EE] text-[#2BA365] border-transparent',
      hover: 'hover:bg-[#DCF4E4]',
    },
    {
      id: 'sports',
      name: 'Sports',
      icon: Dumbbell,
      bg: 'bg-[#FEF1E6] text-[#E57A28] border-transparent',
      hover: 'hover:bg-[#FDE7D4]',
    },
    {
      id: 'furniture',
      name: 'Furniture',
      icon: Armchair,
      bg: 'bg-[#FDF3E5] text-[#D48924] border-transparent',
      hover: 'hover:bg-[#FAEAD2]',
    },
    {
      id: 'accessories',
      name: 'Accessories',
      icon: Headphones,
      bg: 'bg-[#FEECEF] text-[#E04868] border-transparent',
      hover: 'hover:bg-[#FCDDE2]',
    },
    {
      id: 'more',
      name: 'More',
      icon: MoreHorizontal,
      bg: 'bg-[#F5F2EC] text-[#7A746B] border-transparent',
      hover: 'hover:bg-[#EAE6DE]',
    },
  ]

  return (
    <div className="w-full flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 py-1 sm:py-2 px-2 select-none">
      {/* Left "Scroll to explore" indicator matching reference */}
      <button
        type="button"
        onClick={onScrollDown}
        className="flex items-center space-x-2 text-xs font-medium text-stone-500 hover:text-stone-800 transition-colors group cursor-pointer"
      >
        <span className="w-6 h-10 rounded-full border border-stone-300/80 flex items-center justify-center bg-white/40 group-hover:border-stone-400 transition-colors">
          <ChevronDown className="w-3.5 h-3.5 text-stone-500 group-hover:translate-y-0.5 transition-transform" />
        </span>
        <span>Scroll to explore</span>
      </button>

      {/* Floating Glassmorphic Category Bar matching reference */}
      <div className="glass-dock rounded-3xl p-2 sm:p-2.5 flex items-center justify-start md:justify-center gap-1.5 sm:gap-2.5 max-w-full overflow-x-auto scrollbar-none shadow-xl touch-pan-x touch-scroll">
        {categories.map((cat) => {
          const Icon = cat.icon
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.name)}
              className={`flex flex-col items-center justify-center min-w-[70px] sm:min-w-[84px] py-2.5 px-2 rounded-2xl transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-pointer border ${cat.bg} ${cat.hover}`}
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center mb-1">
                <Icon className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
              </div>
              <span className="text-[11px] sm:text-xs font-semibold tracking-tight text-stone-800 whitespace-nowrap">
                {cat.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
