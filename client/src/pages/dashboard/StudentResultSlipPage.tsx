import { useEffect, useState } from 'react'
import { API_BASE } from '../../lib/config'
import { Loader2, Printer, AlertCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

interface ResultSlip {
  school: {
    name: string
    logoUrl: string | null
    address: string | null
    phone: string | null
  }
  student: {
    id: string
    name: string
    gender: string | null
    age: number | null
    admissionNo: string
    rollNumber: string
    email: string
  }
  report: {
    term: string
    academicYear: string
    className: string
    position: number | null
    classSize: number
    totalScore: number
    averageScore: number
    gradePoint: number
    resultSummary: string
    formTeacherComment: string
    principalComment: string
    nextTermInfo: string
    feesInfo: string
    formTeacherName: string
    principalName: string
    feesSummary: {
      totalFees: number
      paidFees: number
      balance: number
    }
  }
  subjects: Array<{
    id: string
    subject: string
    subjectCode: string | null
    continuousAssessment: number
    firstTest: number | null
    secondTest: number | null
    exam: number | null
    total: number | null
    grade: string | null
    remark: string
    teacher: string
  }>
  gradingKey: Array<{
    grade: string
    range: string
    remark: string
  }>
  affectiveSkills: Array<{ id: string; trait: string; rating: string | null }>
  psychomotorSkills: Array<{ id: string; trait: string; rating: string | null }>
}

interface StudentResultRecord {
  id: string
  term: string
  academicYear: string
}

const TERM_RANK: Record<string, number> = {
  Third: 3,
  Second: 2,
  First: 1,
}

const getAcademicYearStart = (value: string) => {
  const [start] = value.split('/')
  const parsed = Number(start)
  return Number.isFinite(parsed) ? parsed : 0
}

const getLatestPeriod = <T extends { academicYear: string; term: string }>(records: T[]) => {
  if (records.length === 0) return null

  return [...records].sort((a, b) => {
    const yearDelta = getAcademicYearStart(b.academicYear) - getAcademicYearStart(a.academicYear)
    if (yearDelta !== 0) return yearDelta
    return (TERM_RANK[b.term] || 0) - (TERM_RANK[a.term] || 0)
  })[0]
}

const StudentResultSlipPage = () => {
  const { token } = useAuth()
  const [academicYear, setAcademicYear] = useState('')
  const [term, setTerm] = useState('First')
  const [slip, setSlip] = useState<ResultSlip | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [availableYears, setAvailableYears] = useState<string[]>([])
  const [hasResolvedDefault, setHasResolvedDefault] = useState(false)

  const buildSchoolLogoUrl = (logoUrl: string) => {
    if (logoUrl.startsWith('http')) return logoUrl
    const normalized = logoUrl.startsWith('/uploads/')
      ? logoUrl.replace('/uploads/', '/api/uploads/')
      : logoUrl
    return `${API_BASE}${normalized}`
  }

  useEffect(() => {
    hydrateAvailablePeriods()
  }, [])

  useEffect(() => {
    if (!hasResolvedDefault || !academicYear) return
    fetchSlip()
  }, [academicYear, term])

  const hydrateAvailablePeriods = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/results`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()

      if (!res.ok || !Array.isArray(data)) {
        setAvailableYears(['2024/2025'])
        setAcademicYear('2024/2025')
        setHasResolvedDefault(true)
        return
      }

      const records = data as StudentResultRecord[]
      const uniqueYears = Array.from(new Set(records.map((record) => record.academicYear))).filter(Boolean)
      const years = uniqueYears.length > 0 ? uniqueYears : ['2024/2025']
      setAvailableYears(years)

      const latestRecord = getLatestPeriod(records)
      setAcademicYear(latestRecord?.academicYear || years[0])
      setTerm(latestRecord?.term || 'First')
      setHasResolvedDefault(true)
    } catch (err) {
      console.error(err)
      setAvailableYears(['2024/2025'])
      setAcademicYear('2024/2025')
      setHasResolvedDefault(true)
    }
  }

  const fetchSlip = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/results/report-slip?academicYear=${encodeURIComponent(academicYear)}&term=${encodeURIComponent(term)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setSlip(data)
      } else {
        setSlip(null)
        setError(data.error || 'No printable result slip is available for the selected term and academic session.')
      }
    } catch (err) {
      console.error(err)
      setSlip(null)
      setError('Failed to load result slip')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto print:max-w-none print:bg-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-black italic text-slate-900 dark:text-slate-100">Printable Result Slip</h1>
          <p className="text-sm font-medium text-slate-500">View and print your full school report sheet for the selected term and academic session.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold">
            {availableYears.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <select value={term} onChange={(e) => setTerm(e.target.value)} className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold">
            <option value="First">First Term</option>
            <option value="Second">Second Term</option>
            <option value="Third">Third Term</option>
          </select>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-brand-700">
            <Printer size={16} /> Print Slip
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-brand-600" size={32} /></div>
      ) : error || !slip ? (
        <div className="rounded-[2rem] border border-slate-100 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertCircle size={28} />
          </div>
          <p className="text-sm font-bold text-slate-500">{error || 'No result slip found.'}</p>
          <p className="mt-2 text-xs font-medium text-slate-400">
            Selection: {term} Term • {academicYear || 'No academic session selected'}
          </p>
        </div>
      ) : (
        <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm print:border-none print:shadow-none dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-6 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-600">Official Result Slip</p>
              <h1 className="text-3xl font-black uppercase italic">{slip.school.name}</h1>
              <p className="text-sm font-medium text-slate-500">{slip.school.address || 'School address not set'}</p>
              <p className="text-sm font-medium text-slate-500">{slip.school.phone || 'School phone not set'}</p>
            </div>
            {slip.school.logoUrl ? (
              <img
                src={buildSchoolLogoUrl(slip.school.logoUrl)}
                alt={slip.school.name}
                className="h-24 w-24 rounded-2xl border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-slate-300 text-[10px] font-black uppercase tracking-widest text-slate-400">
                School Logo
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Student Name</p>
              <p className="mt-2 text-sm font-black text-slate-900">{slip.student.name}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Term / Session</p>
              <p className="mt-2 text-sm font-black text-slate-900">{slip.report.term} Term</p>
              <p className="text-xs font-medium text-slate-500">{slip.report.academicYear}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Class / Position</p>
              <p className="mt-2 text-sm font-black text-slate-900">{slip.report.className}</p>
              <p className="text-xs font-medium text-slate-500">Position: {slip.report.position ?? '-'} / {slip.report.classSize}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Admission / Roll No</p>
              <p className="mt-2 text-sm font-black text-slate-900">{slip.student.admissionNo}</p>
              <p className="text-xs font-medium text-slate-500">Roll No: {slip.student.rollNumber}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Gender / Age</p>
              <p className="mt-2 text-sm font-black text-slate-900">{slip.student.gender || '-'} / {slip.student.age ?? '-'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Score</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{slip.report.totalScore}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Average Score</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{slip.report.averageScore}</p>
            </div>
            <div className="rounded-2xl border border-brand-200 bg-brand-50/70 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-brand-600">Grade Point</p>
              <p className="mt-2 text-2xl font-black text-brand-900">{slip.report.gradePoint}</p>
            </div>
          </div>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Subject</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-right text-slate-500">CA</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-right text-slate-500">Exam</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-right text-slate-500">Total</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-center text-slate-500">Grade</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Remark</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Subject Teacher</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {slip.subjects.map((subject) => (
                  <tr key={subject.id}>
                    <td className="px-4 py-4">
                      <p className="text-sm font-black text-slate-900">{subject.subject}</p>
                      <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">{subject.subjectCode || 'SUBJECT'}</p>
                    </td>
                    <td className="px-4 py-4 text-right font-bold">{subject.continuousAssessment}</td>
                    <td className="px-4 py-4 text-right font-bold">{subject.exam ?? '-'}</td>
                    <td className="px-4 py-4 text-right font-black">{subject.total ?? '-'}</td>
                    <td className="px-4 py-4 text-center font-black">{subject.grade ?? '-'}</td>
                    <td className="px-4 py-4 text-sm font-medium">{subject.remark}</td>
                    <td className="px-4 py-4 text-sm font-medium">{subject.teacher}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Affective Skills</h3>
              <div className="mt-4 space-y-2">
                {slip.affectiveSkills.map((skill) => (
                  <div key={skill.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{skill.trait}</span>
                    <span className="font-black">{skill.rating || '-'}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Psychomotor Skills</h3>
              <div className="mt-4 space-y-2">
                {slip.psychomotorSkills.map((skill) => (
                  <div key={skill.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{skill.trait}</span>
                    <span className="font-black">{skill.rating || '-'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Comments</h3>
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <p className="font-black">Form Teacher Comment</p>
                  <p className="mt-1 font-medium text-slate-600">{slip.report.formTeacherComment || 'Pending form teacher comment.'}</p>
                </div>
                <div>
                  <p className="font-black">Principal Comment</p>
                  <p className="mt-1 font-medium text-slate-600">{slip.report.principalComment || 'Pending principal comment.'}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Next Term / Fees / Signatures</h3>
              <div className="mt-4 space-y-3 text-sm">
                <p><span className="font-black">Next Term Info:</span> <span className="font-medium text-slate-600">{slip.report.nextTermInfo || 'To be announced by the school.'}</span></p>
                <p><span className="font-black">Fees Balance:</span> <span className="font-medium text-slate-600">{slip.report.feesSummary.balance}</span></p>
                <p><span className="font-black">Form Teacher:</span> <span className="font-medium text-slate-600">{slip.report.formTeacherName || '________________'}</span></p>
                <p><span className="font-black">Principal:</span> <span className="font-medium text-slate-600">{slip.report.principalName || '________________'}</span></p>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Grading Key</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-5 text-sm">
              {slip.gradingKey.map((item) => (
                <div key={item.grade} className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="font-black">{item.grade}</p>
                  <p className="text-xs font-medium text-slate-500">{item.range}</p>
                  <p className="text-xs font-medium">{item.remark}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StudentResultSlipPage
