import { motion } from 'framer-motion'
import { 
  Users, 
  UserSquare, 
  ClipboardCheck, 
  FileSpreadsheet, 
  Bell, 
  LayoutDashboard, 
  BookOpen, 
  ShieldCheck 
} from 'lucide-react'

const features = [
  {
    title: "Student Management",
    desc: "Comprehensive records for every student, from enrollment to graduation.",
    icon: Users
  },
  {
    title: "Teacher Management",
    desc: "Manage staff assignments, schedules, and professional performance.",
    icon: UserSquare
  },
  {
    title: "Attendance Tracking",
    desc: "Automated daily attendance for students and staff with real-time reports.",
    icon: ClipboardCheck
  },
  {
    title: "Results & Report Cards",
    desc: "Dynamic result processing and professional digital report card generation.",
    icon: FileSpreadsheet
  },
  {
    title: "School Notices",
    desc: "Instant communication of holidays, events, and urgent announcements.",
    icon: Bell
  },
  {
    title: "Role-Based Dashboards",
    desc: "Tailored experiences for Directors, Principals, Teachers, and Students.",
    icon: LayoutDashboard
  },
  {
    title: "Class & Subject Management",
    desc: "Effortless organization of academic structures and course allocations.",
    icon: BookOpen
  },
  {
    title: "Secure Login System",
    desc: "Multi-tenant isolation and secure authentication for total data privacy.",
    icon: ShieldCheck
  }
]

const Features = () => {
  return (
    <section id="features" className="py-24 px-6 bg-slate-50/50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center space-y-4 mb-20">
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-brand-600 font-bold tracking-widest uppercase text-sm"
          >
            Powerful Capabilities
          </motion.p>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-black text-slate-900"
          >
            Everything Your School Needs
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-slate-500 max-w-2xl mx-auto text-lg font-medium"
          >
            Our comprehensive platform eliminates administrative headaches, allowing you to focus on what matters most: Education.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -5 }}
              className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-brand-100/50 transition-all group"
            >
              <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 mb-6 group-hover:scale-110 group-hover:bg-brand-600 group-hover:text-white transition-all duration-300">
                <f.icon size={28} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed font-medium">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Features
