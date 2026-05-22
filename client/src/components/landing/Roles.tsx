import { motion } from 'framer-motion'
import { Briefcase, UserCog, UserCheck, GraduationCap, CheckCircle2 } from 'lucide-react'

const roles = [
  {
    role: "Director",
    desc: "Full institutional oversight and financial analysis.",
    icon: Briefcase,
    color: "from-brand-600 to-brand-800",
    features: ["Financial Reports", "Strategic Planning", "Audit Logs", "School Multi-Branch"]
  },
  {
    role: "Principal",
    desc: "Daily operational management and staff supervision.",
    icon: UserCog,
    color: "from-indigo-600 to-indigo-800",
    features: ["Staff Scheduling", "Event Management", "Policy Enforcement", "Academic Oversight"]
  },
  {
    role: "Teacher",
    desc: "Classroom instruction and student evaluation.",
    icon: UserCheck,
    color: "from-blue-600 to-blue-800",
    features: ["Marking Attendance", "Result Input", "Lesson Planning", "Student Progress"]
  },
  {
    role: "Student",
    desc: "Academic progress tracking and resources access.",
    icon: GraduationCap,
    color: "from-slate-700 to-slate-900",
    features: ["View Results", "Download Resources", "Attendance History", "Digital ID Card"]
  }
]

const Roles = () => {
  return (
    <section className="py-24 px-6 bg-slate-900 text-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500 rounded-full blur-[150px]"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500 rounded-full blur-[150px]"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center space-y-4 mb-20">
          <h2 className="text-4xl md:text-5xl font-black italic">One System. Multiple <span className="text-brand-400">Perspectives.</span></h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg font-medium">
            EduNexus Pro delivers a tailored dashboard experience for every stakeholder in the school ecosystem.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {roles.map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white/5 backdrop-blur-sm border border-white/10 p-8 rounded-[2.5rem] hover:bg-white/10 transition-all flex flex-col justify-between"
            >
              <div>
                <div className={`w-14 h-14 bg-gradient-to-br ${r.color} rounded-2xl flex items-center justify-center mb-6 shadow-xl`}>
                  <r.icon size={28} />
                </div>
                <h3 className="text-2xl font-black mb-2">{r.role}</h3>
                <p className="text-slate-400 text-sm font-medium leading-relaxed mb-6">
                  {r.desc}
                </p>
                <div className="space-y-3">
                  {r.features.map((f, j) => (
                    <div key={j} className="flex items-center gap-3 text-xs font-bold text-slate-300">
                      <CheckCircle2 size={14} className="text-brand-400" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
              <button className="mt-8 w-full py-4 text-sm font-black border border-white/10 rounded-2xl hover:bg-white hover:text-slate-900 transition-all">
                Learn More
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Roles
