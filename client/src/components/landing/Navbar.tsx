import { useState } from 'react'
import { motion } from 'framer-motion'
import { Menu, School, X } from 'lucide-react'
import { Link } from 'react-router-dom'

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Features', href: '/#features' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'About', href: '#about' },
  { label: 'Pricing', href: '#pricing' },
]

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6"
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between rounded-[1.75rem] border border-slate-200/70 bg-white/92 px-5 py-4 shadow-[0_18px_50px_-22px_rgba(15,23,42,0.35)] backdrop-blur-xl sm:px-6">
        <Link to="/" className="flex items-center gap-3 text-slate-950">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-sky-400 text-white shadow-lg shadow-brand-500/25">
            <School size={23} />
          </div>
          <div className="leading-none">
            <p className="text-lg font-black tracking-tight text-slate-950 sm:text-xl">
              EduNexus <span className="text-brand-600">Pro</span>
            </p>
            <p className="hidden text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400 sm:block">
              School OS for modern campuses
            </p>
          </div>
        </Link>

        <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50/90 p-1.5 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-bold text-slate-600 transition-all hover:bg-white hover:text-slate-950"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/login"
            className="rounded-full px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:text-brand-700"
          >
            Login
          </Link>
          <Link
            to="/register"
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-0.5 hover:bg-brand-700"
          >
            Register School
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 md:hidden"
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="mx-auto mt-3 max-w-7xl rounded-[1.75rem] border border-slate-200 bg-white/96 p-4 shadow-[0_18px_50px_-22px_rgba(15,23,42,0.35)] backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-center text-sm font-bold text-slate-800"
            >
              Login
            </Link>
            <Link
              to="/register"
              onClick={() => setMobileOpen(false)}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white"
            >
              Register
            </Link>
          </div>
        </div>
      )}
    </motion.header>
  )
}

export default Navbar
