import { UploadCloud, MessageSquareText, CheckCircle } from 'lucide-react'

export function HowItWorksSection() {
  const steps = [
    {
      step: '01',
      icon: UploadCloud,
      title: 'List or Request an Item',
      description:
        'Choose whether you want to lend, rent, borrow, or sell. Add a title, photo, and select your return duration or rental price.',
    },
    {
      step: '02',
      icon: MessageSquareText,
      title: 'Connect & Safe Handoff',
      description:
        'Coordinate safely with fellow students using in-app campus messaging. Meet at designated university locations like student centers or libraries.',
    },
    {
      step: '03',
      icon: CheckCircle,
      title: 'Return & Keep the Cycle Going',
      description:
        'Automated return reminders keep everyone on schedule. Mark items returned with a single tap and build trusted campus reputation.',
    },
  ]

  return (
    <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-20">
      <div className="rounded-3xl bg-stone-100/70 border border-stone-200/80 p-8 sm:p-12 lg:p-16">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800 font-mono bg-white px-3 py-1 rounded-full border border-stone-200 inline-block mb-3">
            Campus Workflow
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
            How CampusShare Works
          </h2>
          <p className="mt-3 text-sm sm:text-base text-stone-600">
            A frictionless, peer-to-peer exchange designed around campus geography and student routines.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {steps.map((st, idx) => {
            const Icon = st.icon
            return (
              <div key={st.step} className="relative flex flex-col items-start bg-white p-7 rounded-2xl border border-stone-200/70 shadow-xs">
                <div className="w-full flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-100 font-bold">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="font-mono text-2xl font-black text-stone-300">
                    {st.step}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-stone-900 mb-2">
                  {st.title}
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-normal">
                  {st.description}
                </p>
                {idx < 2 && (
                  <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-stone-200 text-stone-400 z-10 flex items-center justify-center text-xs font-bold">
                    &rarr;
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
