import { motion } from 'framer-motion'
import { Star, ShieldCheck, Award, Globe } from 'lucide-react'

const testimonials = [
  {
    name: "Dr. Sarah Johnson",
    role: "Proprietress, Grace Academy",
    text: "EduNexus Pro transformed our result processing from weeks to minutes. A total game changer for our administrative staff.",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah"
  },
  {
    name: "Mr. Yusuf Ahmed",
    role: "Principal, Crescent International",
    text: "The student attendance tracking is flawless. Parents love that they can check their children's progress instantly.",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=yusuf"
  }
]

const Trust = () => {
  return (
    <section className="py-24 px-6 bg-slate-50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center space-y-4 mb-20">
          <h2 className="text-4xl font-black text-slate-900">Trusted by Educational Leaders</h2>
          <p className="text-slate-500 max-w-2xl mx-auto text-lg font-medium italic">
            "Reliability and excellence at the heart of our school's digital operations."
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-20">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between"
            >
              <div className="flex gap-1 mb-8">
                {[1, 2, 3, 4, 5].map((s) => <Star key={s} size={18} className="fill-yellow-400 text-yellow-400" />)}
              </div>
              <p className="text-xl text-slate-700 italic font-medium leading-relaxed mb-10">"{t.text}"</p>
              <div className="flex items-center gap-4 border-t border-slate-100 pt-8">
                 <img src={t.avatar} alt={t.name} className="w-14 h-14 rounded-full bg-slate-100 ring-4 ring-slate-50" />
                 <div>
                    <h4 className="font-black text-slate-900">{t.name}</h4>
                    <p className="text-sm text-slate-500 font-bold">{t.role}</p>
                 </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-12 opacity-40 grayscale group hover:grayscale-0 transition-all duration-700">
           <div className="flex items-center gap-2 font-black text-2xl"><ShieldCheck size={32} /> ACADEMIC SECURE</div>
           <div className="flex items-center gap-2 font-black text-2xl"><Award size={32} /> EDTECH 2026</div>
           <div className="flex items-center gap-2 font-black text-2xl"><Globe size={32} /> GLOBAL TEACH</div>
           <div className="flex items-center gap-2 font-black text-2xl tracking-tighter italic underline decoration-brand-600">TRUSTED SCHOOLS</div>
        </div>
      </div>
    </section>
  )
}

export default Trust
