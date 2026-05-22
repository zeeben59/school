import { Link } from 'react-router-dom'
import { Bot, CircleHelp, Sparkles } from 'lucide-react'

const prompts = [
  'How do I add a teacher?',
  'How do I upload results?',
  'How do I mark attendance?',
  'How do I renew my subscription?',
  "Why can't my student see results?",
]

const PlatformAIHelp = () => {
  return (
    <section className="px-6 py-20 bg-slate-50/70">
      <div className="max-w-6xl mx-auto rounded-[2rem] border border-slate-200 bg-white p-8 md:p-12 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-brand-700">
          <Bot size={14} />
          AI Platform Help
        </div>

        <div className="mt-5 grid gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900">Get Help With This School Platform</h2>
            <p className="text-slate-600 font-medium leading-relaxed">
              The assistant is focused on EduNexus workflows only. It helps Directors, Principals, Teachers, and Students complete tasks in this platform faster.
            </p>
            <p className="text-sm text-slate-500 font-medium">
              It does not act as a general internet chatbot.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-brand-700">
                <Sparkles size={14} /> Login to Ask AI
              </Link>
              <Link to="/login" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50">
                <CircleHelp size={14} /> Need Human Support?
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Example Questions</p>
            <ul className="mt-4 space-y-3">
              {prompts.map((prompt) => (
                <li key={prompt} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                  {prompt}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

export default PlatformAIHelp
