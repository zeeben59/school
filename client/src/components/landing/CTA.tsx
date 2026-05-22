import { motion } from 'framer-motion'
import { Rocket, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

const CTA = () => {
  return (
    <section className="py-24 px-6 relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="premium-gradient p-12 md:p-20 rounded-[3rem] text-white text-center space-y-10 relative overflow-hidden shadow-2xl shadow-brand-400/50"
        >
          {/* Background pattern */}
          <div className="absolute top-0 left-0 w-full h-full opacity-10 flex flex-wrap gap-20 pointer-events-none">
             {[1,2,3,4,5,6].map(i => <Rocket key={i} size={400} className="rotate-45" />)}
          </div>

          <div className="relative z-10 space-y-6">
            <h2 className="text-4xl md:text-6xl font-black italic">Transform Your School <span className="underline decoration-white/30 truncate">Today.</span></h2>
            <p className="text-xl text-white/80 max-w-2xl mx-auto font-medium leading-relaxed">
              Join hundreds of schools currently using EduNexus Pro to deliver world-class educational management.
            </p>
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row gap-6 justify-center">
            <Link to="/register" className="bg-white text-brand-600 px-10 py-5 rounded-2xl font-black text-xl shadow-xl flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all">
              Initialize My School
            </Link>
            <button className="bg-white/10 backdrop-blur-md text-white border-2 border-white/20 px-10 py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-2 hover:bg-white/20 transition-all active:scale-95">
              Contact Sales <ArrowRight size={22} />
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default CTA
