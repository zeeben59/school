import { School, Facebook, Twitter, Instagram, Linkedin, Mail, Phone, MapPin } from 'lucide-react'

const Footer = () => {
  return (
    <footer className="bg-slate-50 border-t border-slate-100 pt-20 pb-10 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-20">
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="premium-gradient p-2 rounded-lg text-white">
                <School size={20} />
              </div>
              <span className="text-xl font-black italic tracking-tight text-slate-900">EduNexus <span className="text-brand-600">Pro</span></span>
            </div>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              Leading the digital transformation of educational institutions with secure, scalable, and intuitive management solutions.
            </p>
            <div className="flex items-center gap-4 text-slate-400">
               <a href="#" className="hover:text-brand-600 transition-colors"><Facebook size={20} /></a>
               <a href="#" className="hover:text-brand-600 transition-colors"><Twitter size={20} /></a>
               <a href="#" className="hover:text-brand-600 transition-colors"><Instagram size={20} /></a>
               <a href="#" className="hover:text-brand-600 transition-colors"><Linkedin size={20} /></a>
            </div>
          </div>

          <div>
            <h4 className="text-slate-900 font-black mb-6 uppercase tracking-wider text-xs">Quick Links</h4>
            <ul className="space-y-4 text-slate-500 text-sm font-bold">
               <li><a href="#home" className="hover:text-brand-600 transition-colors">Home</a></li>
               <li><a href="#features" className="hover:text-brand-600 transition-colors">Features</a></li>
               <li><a href="#about" className="hover:text-brand-600 transition-colors">About Us</a></li>
               <li><a href="#pricing" className="hover:text-brand-600 transition-colors">Pricing</a></li>
               <li><a href="#contact" className="hover:text-brand-600 transition-colors">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-900 font-black mb-6 uppercase tracking-wider text-xs">Features</h4>
            <ul className="space-y-4 text-slate-500 text-sm font-bold">
               <li><a href="#" className="hover:text-brand-600 transition-colors">Student Mgmt</a></li>
               <li><a href="#" className="hover:text-brand-600 transition-colors">Result System</a></li>
               <li><a href="#" className="hover:text-brand-600 transition-colors">Portals</a></li>
               <li><a href="#" className="hover:text-brand-600 transition-colors">Payments</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-900 font-black mb-6 uppercase tracking-wider text-xs">Contact Us</h4>
            <ul className="space-y-4 text-slate-500 text-sm font-medium">
               <li className="flex items-center gap-3"><Mail size={16} className="text-brand-600" /> info@edunexus.pro</li>
               <li className="flex items-center gap-3"><Phone size={16} className="text-brand-600" /> +234 812 345 6789</li>
               <li className="flex items-center gap-3 items-start"><MapPin size={16} className="text-brand-600 mt-1 shrink-0" /> 123 Education Way, Tech City, Lagos, Nigeria</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-10 flex flex-col md:row items-center justify-between gap-6">
           <p className="text-slate-400 text-xs font-bold">© 2026 EduNexus Pro School Management System. All rights reserved.</p>
           <div className="flex gap-8 text-slate-400 text-xs font-bold">
              <a href="#" className="hover:text-brand-600 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-brand-600 transition-colors">Terms of Service</a>
           </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
