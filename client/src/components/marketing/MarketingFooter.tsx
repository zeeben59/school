import { Link } from 'react-router-dom'

const MarketingFooter = () => {
  return (
    <footer id="contact" className="border-t border-slate-200 bg-white px-6 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-lg font-bold text-slate-900">SchoolFlow</p>
          <p className="text-sm text-slate-600">Modern school operations, built for scale.</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-600">
          <Link to="/" className="hover:text-slate-900">
            Home
          </Link>
          <Link to="/about" className="hover:text-slate-900">
            About
          </Link>
          <Link to="/pricing" className="hover:text-slate-900">
            Pricing
          </Link>
          <Link to="/login" className="hover:text-slate-900">
            Login
          </Link>
          <Link to="/register" className="hover:text-slate-900">
            Register
          </Link>
        </div>
        <p className="text-sm text-slate-500">Copyright {new Date().getFullYear()} SchoolFlow.</p>
      </div>
    </footer>
  )
}

export default MarketingFooter
