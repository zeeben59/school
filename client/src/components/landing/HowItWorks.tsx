import { motion } from 'framer-motion'
import { PlusCircle, Users, ClipboardCheck, ArrowUpRight } from 'lucide-react'

const steps = [
  {
    title: "Register Your School",
    desc: "Create your school profile and start with a 3-day trial, then activate a term subscription.",
    icon: PlusCircle,
    color: "bg-blue-500"
  },
  {
    title: "Setup Staff & Students",
    desc: "Bulk import or manually create accounts for your entire school community.",
    icon: Users,
    color: "bg-brand-600"
  },
  {
    title: "Manage Daily Activity",
    desc: "Record attendance, process results, and manage your school schedule.",
    icon: ClipboardCheck,
    color: "bg-indigo-600"
  },
  {
    title: "Access Reports",
    desc: "Instantly generate insights and reports for data-driven decisions.",
    icon: ArrowUpRight,
    color: "bg-slate-900"
  }
]

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 px-6 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center space-y-4 mb-20">
          <h2 className="text-4xl md:text-5xl font-black text-slate-900">Simple 4-Step Process</h2>
          <p className="text-slate-500 max-w-2xl mx-auto text-lg font-medium">
            Starting with EduNexus Pro is easy. We've simplified school management so you can get started immediately.
          </p>
        </div>

        <div className="relative">
          {/* Connector Line (Desktop) */}
          <div className="hidden lg:block absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 z-0"></div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
            {steps.map((step, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative z-10 flex flex-col items-center text-center space-y-4"
              >
                <div className={`w-20 h-20 ${step.color} text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-brand-100 ring-8 ring-white`}>
                  <step.icon size={32} />
                </div>
                <div className="pt-4">
                  <h3 className="text-xl font-extrabold text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-slate-500 text-sm font-medium leading-relaxed">
                    {step.desc}
                  </p>
                </div>
                
                {/* Step indicator */}
                <div className="absolute -top-4 -left-4 w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold text-xs ring-4 ring-white shadow-lg">
                  {i + 1}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default HowItWorks
