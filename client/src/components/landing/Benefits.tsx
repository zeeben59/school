import { motion } from 'framer-motion'
import { Zap, Scroll, Layout, MousePointer2, Globe, ShieldCheck } from 'lucide-react'

const benefits = [
  {
    title: "Saves Time",
    desc: "Automate repetitive tasks like attendance and result processing.",
    icon: Zap
  },
  {
    title: "Reduces Paperwork",
    desc: "Go 100% digital with students records and staff documentation.",
    icon: Scroll
  },
  {
    title: "Better Admin",
    desc: "Centralized control for all school administrative functions.",
    icon: Layout
  },
  {
    title: "Easy to Use",
    desc: "Intuitive interface requiring minimal training for staff.",
    icon: MousePointer2
  },
  {
    title: "Access Anywhere",
    desc: "Cloud-based system accessible from any device, anytime.",
    icon: Globe
  },
  {
    title: "Secure & Organized",
    desc: "Enterprise-grade security keeps your school's data safe.",
    icon: ShieldCheck
  }
]

const Benefits = () => {
  return (
    <section id="about" className="scroll-mt-36 py-24 px-6 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight">
              Transform Your School <span className="text-brand-600">Culture</span> with Digital Efficiency
            </h2>
            <p className="text-lg text-slate-500 font-medium leading-relaxed">
              EduNexus Pro is more than just software—it's a catalyst for administrative excellence. We help you move away from legacy methods and embrace the future of EdTech.
            </p>
            <div className="pt-4 grid sm:grid-cols-2 gap-4">
               {["90% Less Paperwork", "Fast Result Processing", "Instant Parent Notices", "Secure Data Backup"].map((pill, i) => (
                 <div key={i} className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-4 rounded-2xl text-sm font-bold text-slate-700">
                    <div className="w-2 h-2 rounded-full bg-brand-500"></div>
                    {pill}
                 </div>
               ))}
            </div>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-6">
            {benefits.map((b, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-6 rounded-3xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50/30 transition-all group"
              >
                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-brand-600 mb-4 group-hover:bg-brand-600 group-hover:text-white transition-all">
                  <b.icon size={24} />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">{b.title}</h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                  {b.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default Benefits
