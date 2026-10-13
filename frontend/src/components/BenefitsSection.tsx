import { ShieldCheck, PiggyBank, Recycle, CheckCircle2 } from 'lucide-react'

export function BenefitsSection() {
  const benefits = [
    {
      icon: ShieldCheck,
      badge: 'Verified & Secure',
      title: 'Verified Campus Community',
      description:
        'Every participant is authenticated through university email credentials or verified campus ID, ensuring accountability, trust, and safe peer-to-peer handoffs.',
      points: [
        'Institutional domain verification',
        'Transparent student profiles',
        'Safe campus meetup coordination',
      ],
      theme: 'from-emerald-50 to-emerald-100/50 text-emerald-800 border-emerald-200/60',
      iconBg: 'bg-emerald-700 text-white',
    },
    {
      icon: PiggyBank,
      badge: 'Student Friendly',
      title: 'Affordable Access',
      description:
        'Why pay hundreds for a single-semester textbook, camera for a weekend project, or specialized lab tool? Borrow or rent from peers at fraction-of-retail rates.',
      points: [
        'Flexible daily, weekly, or term lending',
        'Direct peer-to-peer micro-transactions',
        'No inflated retailer or middleman markups',
      ],
      theme: 'from-amber-50 to-amber-100/50 text-amber-900 border-amber-200/60',
      iconBg: 'bg-amber-600 text-white',
    },
    {
      icon: Recycle,
      badge: 'Zero-Waste Campus',
      title: 'Reuse Existing Resources',
      description:
        'Keep perfectly good electronics, lab kits, monitors, and sports gear circulating across student generations instead of gathering dust in dorm closets.',
      points: [
        'Promotes campus sustainability',
        'Reduces single-semester waste',
        'Maximizes the lifecycle of student equipment',
      ],
      theme: 'from-sky-50 to-sky-100/50 text-sky-900 border-sky-200/60',
      iconBg: 'bg-sky-700 text-white',
    },
  ]

  return (
    <section id="benefits" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-20">
      <div className="text-center max-w-2xl mx-auto mb-14">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800 font-mono bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60 inline-block mb-3">
          Campus Ecosystem
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
          Designed for Everyday Student Life
        </h2>
        <p className="mt-3 text-base text-stone-600">
          CampusShare replaces fragmented group chats with a trusted, organized sharing network for your university.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {benefits.map((b) => {
          const Icon = b.icon
          return (
            <div
              key={b.title}
              className={`p-7 rounded-3xl bg-gradient-to-b ${b.theme} border shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className={`w-12 h-12 rounded-2xl ${b.iconBg} flex items-center justify-center shadow-md`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/80 border border-current shadow-2xs">
                    {b.badge}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-stone-900 mb-2.5">
                  {b.title}
                </h3>
                <p className="text-sm text-stone-700 leading-relaxed mb-6 font-normal">
                  {b.description}
                </p>
              </div>

              <div className="pt-4 border-t border-black/5 space-y-2">
                {b.points.map((pt) => (
                  <div key={pt} className="flex items-center text-xs text-stone-700 font-medium">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-700 flex-shrink-0" />
                    <span>{pt}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
