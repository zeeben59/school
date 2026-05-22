import { motion } from 'framer-motion'
import { ChevronRight, ShieldCheck, Users, BookOpen, GraduationCap } from 'lucide-react'
import { Link } from 'react-router-dom'

const Hero = () => {
  return (
    <section id="home" className="pt-32 pb-20 px-6 max-w-7xl mx-auto overflow-hidden">
      <div className="grid lg:grid-cols-2 gap-16 items-center">
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-8"
        >
          <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
            <ShieldCheck size={14} />
            Secure Multi-tenant Platform
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black leading-tight text-slate-900">
            Manage Your <span className="text-brand-600">School</span> Smarter, Faster, Better.
          </h1>
          
          <p className="text-xl text-slate-500 max-w-xl leading-relaxed font-medium">
            The all-in-one management platform for students, teachers, results, and administration. Streamline your entire school workflow in one secure place.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-5">
            <Link to="/register" className="premium-gradient text-white px-10 py-5 rounded-2xl font-black text-lg shadow-2xl shadow-brand-200 flex items-center justify-center gap-2 hover:translate-y-[-2px] hover:shadow-brand-300 transition-all active:scale-95">
              Register School <ChevronRight size={22} />
            </Link>
            <Link to="/login" className="bg-white text-slate-900 border-2 border-slate-100 px-10 py-5 rounded-2xl font-black text-lg shadow-sm hover:bg-slate-50 hover:border-slate-200 transition-all active:scale-95">
              System Login
            </Link>
          </div>

          <div className="flex items-center gap-6 pt-6">
            <div className="flex -space-x-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-12 h-12 rounded-full border-4 border-white bg-slate-200 flex items-center justify-center overflow-hidden shadow-sm">
                   <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 1337}`} alt="user" />
                </div>
              ))}
            </div>
            <div>
              <p className="text-sm text-slate-900 font-bold">Trusted by 250+ Schools</p>
              <p className="text-xs text-slate-400 font-medium tracking-wide">Across 15 states and growing</p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative"
        >
           {/* Decorative Elements */}
           <div className="absolute -top-20 -right-20 w-80 h-80 bg-brand-200 rounded-full blur-[100px] opacity-30"></div>
           <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-indigo-200 rounded-full blur-[100px] opacity-30"></div>

           {/* Dashboard Preview Mockup */}
           <div className="relative glass p-5 rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/40 ring-1 ring-black/5 rotate-2 hover:rotate-0 transition-transform duration-700 ease-out group">
              <div className="bg-slate-50 rounded-[1.5rem] p-8 space-y-8 min-h-[400px]">
                 <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                    <div className="h-5 w-48 bg-slate-200 rounded-full"></div>
                    <div className="flex gap-2.5">
                      <div className="h-3 w-3 rounded-full bg-red-400"></div>
                      <div className="h-3 w-3 rounded-full bg-yellow-400"></div>
                      <div className="h-3 w-3 rounded-full bg-green-400"></div>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-3 gap-6">
                    <div className="h-32 bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between group-hover:scale-105 transition-transform">
                      <Users className="text-brand-500" size={24} />
                      <div className="space-y-2">
                        <div className="h-3 w-16 bg-slate-100 rounded-full"></div>
                        <div className="h-4 w-10 bg-brand-50 rounded-full"></div>
                      </div>
                    </div>
                    <div className="h-32 bg-brand-600 rounded-2xl shadow-xl p-5 flex flex-col justify-between text-white shadow-brand-200 group-hover:translate-y-[-10px] transition-transform">
                      <BookOpen size={24} />
                      <div className="space-y-2">
                        <div className="h-3 w-20 bg-brand-400 rounded-full"></div>
                        <div className="h-4 w-12 bg-white/20 rounded-full"></div>
                      </div>
                    </div>
                    <div className="h-32 bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between group-hover:scale-105 transition-transform">
                      <GraduationCap className="text-brand-500" size={24} />
                      <div className="space-y-2">
                        <div className="h-3 w-12 bg-slate-100 rounded-full"></div>
                        <div className="h-4 w-16 bg-brand-50 rounded-full"></div>
                      </div>
                    </div>
                 </div>

                 <div className="space-y-5 pt-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center">
                        <div className="h-6 w-6 bg-indigo-200 rounded-full"></div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-3 w-56 bg-slate-200 rounded-full"></div>
                        <div className="h-2 w-32 bg-slate-100 rounded-full"></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-brand-50 flex items-center justify-center">
                        <div className="h-6 w-6 bg-brand-200 rounded-full"></div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-3 w-44 bg-slate-200 rounded-full"></div>
                        <div className="h-2 w-24 bg-slate-100 rounded-full"></div>
                      </div>
                    </div>
                 </div>
              </div>
           </div>
        </motion.div>
      </div>
    </section>
  )
}

export default Hero
