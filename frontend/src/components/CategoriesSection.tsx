import {
  Book,
  Laptop,
  FlaskConical,
  Dumbbell,
  Armchair,
  Headphones,
  MoreHorizontal,
  ArrowRight,
} from 'lucide-react'

interface CategoriesSectionProps {
  onSelectCategory: (categoryName: string) => void
}

export function CategoriesSection({ onSelectCategory }: CategoriesSectionProps) {
  const categoryDetails = [
    {
      name: 'Books',
      icon: Book,
      count: 'Textbooks, Study Guides & Fiction',
      examples: ['Engineering Textbooks', 'Medical Atlases', 'Prep Guides', 'Calculus Notes'],
      color: 'bg-indigo-50 border-indigo-200/70 text-indigo-700',
      tag: 'Lend & Buy',
    },
    {
      name: 'Electronics',
      icon: Laptop,
      count: 'Gadgets, Displays & Peripherals',
      examples: ['Graphing Calculators', 'Portable Monitors', 'Keyboards', 'Adapters & Hubs'],
      color: 'bg-sky-50 border-sky-200/70 text-sky-700',
      tag: 'Rent & Borrow',
    },
    {
      name: 'Lab Equipment',
      icon: FlaskConical,
      count: 'Science, Engineering & Workshop Kits',
      examples: ['Lab Coats & Goggles', 'Breadboards', 'Arduino Kits', 'Dissection Tools'],
      color: 'bg-emerald-50 border-emerald-200/70 text-emerald-700',
      tag: 'Borrow & Lend',
    },
    {
      name: 'Sports',
      icon: Dumbbell,
      count: 'Fitness, Team Sports & Recreation',
      examples: ['Badminton Rackets', 'Basketballs', 'Yoga Mats', 'Camping Tents'],
      color: 'bg-amber-50 border-amber-200/70 text-amber-700',
      tag: 'Lend & Rent',
    },
    {
      name: 'Furniture',
      icon: Armchair,
      count: 'Dorm & Apartment Essentials',
      examples: ['Desk Lamps', 'Ergonomic Cushions', 'Mini Drawers', 'Shoe Racks'],
      color: 'bg-orange-50 border-orange-200/70 text-orange-700',
      tag: 'Buy & Sell',
    },
    {
      name: 'Accessories',
      icon: Headphones,
      count: 'Audio, Bags & Daily Carry',
      examples: ['Studio Headphones', 'Camera Tripods', 'Laptop Sleeves', 'Umbrellas'],
      color: 'bg-rose-50 border-rose-200/70 text-rose-700',
      tag: 'Rent & Borrow',
    },
  ]

  return (
    <section id="categories" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800 font-mono bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60 inline-block mb-3">
            Item Categories
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
            Everything College Life Requires
          </h2>
          <p className="mt-2 text-stone-600 max-w-xl text-sm sm:text-base">
            From heavy course textbooks to weekend camping equipment, find or share whatever you need on campus.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onSelectCategory('All Items')}
          className="mt-4 md:mt-0 inline-flex items-center text-sm font-semibold text-emerald-800 hover:text-emerald-900 group cursor-pointer"
        >
          <span>View all category options</span>
          <ArrowRight className="w-4 h-4 ml-1.5 transition-transform group-hover:translate-x-1" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {categoryDetails.map((cat) => {
          const Icon = cat.icon
          return (
            <div
              key={cat.name}
              onClick={() => onSelectCategory(cat.name)}
              className="p-6 rounded-3xl bg-white border border-stone-200/80 shadow-2xs hover:shadow-lg hover:border-emerald-300/80 transition-all duration-200 cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-2xl ${cat.color} flex items-center justify-center border shadow-2xs group-hover:scale-105 transition-transform`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700">
                    {cat.tag}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-stone-900 group-hover:text-emerald-800 transition-colors">
                  {cat.name}
                </h3>
                <p className="text-xs text-stone-500 mt-1 mb-4">
                  {cat.count}
                </p>

                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-stone-100">
                  {cat.examples.map((item) => (
                    <span
                      key={item}
                      className="text-[11px] font-medium text-stone-600 bg-stone-50 px-2 py-0.5 rounded-md border border-stone-200/60"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5 pt-3 flex items-center justify-between text-xs font-semibold text-emerald-800 group-hover:text-emerald-900">
                <span>Browse {cat.name}</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          )
        })}

        {/* 7th Card: "And More..." */}
        <div
          onClick={() => onSelectCategory('Other')}
          className="p-6 rounded-3xl bg-stone-50/80 border border-dashed border-stone-300 hover:border-emerald-400 transition-all duration-200 cursor-pointer flex flex-col justify-between group sm:col-span-2 lg:col-span-3"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-white border border-stone-200 text-stone-600 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                <MoreHorizontal className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-stone-900">
                  Looking for something else?
                </h3>
                <p className="text-xs text-stone-600">
                  Post a custom item request to students across campus &mdash; musical instruments, art supplies, event costumes, and tools.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="px-5 py-2.5 rounded-full text-xs font-semibold bg-white text-stone-800 border border-stone-200 shadow-2xs group-hover:bg-emerald-800 group-hover:text-white transition-colors cursor-pointer"
            >
              Post a Request
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
