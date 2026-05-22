import { Menu, School, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Features', to: '/#features' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
]

const baseLinkClass =
  'rounded-lg px-3 py-2 text-sm font-medium transition-colors'

const MarketingNavbar = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10)
    handleScroll()
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const isAnchorActive = (target: string) => {
    if (target === '/#features') {
      return location.pathname === '/' && location.hash === '#features'
    }
    return false
  }

  return (
    <header className="sticky top-0 z-50 px-4 pt-4 sm:px-6">
      <nav
        className={`mx-auto flex w-full max-w-6xl items-center justify-between rounded-2xl border px-4 py-3 transition-all sm:px-6 ${
          isScrolled
            ? 'border-slate-200 bg-white/95 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.35)] backdrop-blur'
            : 'border-slate-200/70 bg-white/80 backdrop-blur'
        }`}
      >
        <Link to="/" className="flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <School size={18} />
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">SchoolFlow</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            if (item.to.includes('#')) {
              return (
                <a
                  key={item.label}
                  href={item.to}
                  className={`${baseLinkClass} ${
                    isAnchorActive(item.to) ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </a>
              )
            }
            return (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) =>
                  `${baseLinkClass} ${
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            )
          })}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/login"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Login
          </Link>
          <Link
            to="/register"
            className="rounded-lg bg-gradient-to-r from-brand-700 to-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Get Started
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-700 md:hidden"
          aria-label="Toggle menu"
        >
          {isOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </nav>

      {isOpen && (
        <div className="mx-auto mt-2 w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-4 shadow-lg md:hidden">
          <div className="flex flex-col gap-2">
            {navItems.map((item) =>
              item.to.includes('#') ? (
                <a
                  key={item.label}
                  href={item.to}
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  {item.label}
                </a>
              ) : (
                <NavLink
                  key={item.label}
                  to={item.to}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`
                  }
                >
                  {item.label}
                </NavLink>
              ),
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link
              to="/login"
              className="rounded-lg border border-slate-300 px-4 py-2 text-center text-sm font-semibold text-slate-700"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="rounded-lg bg-gradient-to-r from-brand-700 to-brand-500 px-4 py-2 text-center text-sm font-semibold text-white"
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

export default MarketingNavbar
