import { useState, useEffect, useMemo } from 'react'
import { API_BASE } from '../../lib/config'
import { Link } from 'react-router-dom'
import {
  FileCheck,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  UserCheck,
  School,
  Upload
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

interface Result {
  id: string
  firstTest: number | null
  secondTest: number | null
  exam: number | null
  total: number | null
  grade: string | null
  term: string
  academicYear: string
  student: {
    id: string
    admissionNo: string
    user: { firstName: string, lastName: string }
  }
}

interface SubjectRecord {
  id: string
  name: string
  classId: string | null
  class?: {
    id: string
    name: string
    _count?: { enrollments: number }
  }
}

interface ResultDocument {
  id: string
  studentId: string
  academicYear: string
  term: string
  originalFileName: string
  viewUrl: string
  downloadUrl: string
}

interface ClassStudentEntry {
  student: {
    id: string
    admissionNo: string
    user: {
      firstName: string
      lastName: string
    }
  }
}

function normalizeListPayload<T>(data: unknown, candidateKeys: string[] = []): T[] {
  if (Array.isArray(data)) return data as T[]
  if (!data || typeof data !== 'object') return []

  const record = data as Record<string, unknown>
  for (const key of candidateKeys) {
    const value = record[key]
    if (Array.isArray(value)) return value as T[]
  }

  for (const value of Object.values(record)) {
    if (Array.isArray(value)) return value as T[]
  }

  return []
}

const calculateTotalAndGrade = (firstTest: string, secondTest: string, exam: string) => {
  const first = firstTest === '' ? 0 : Number(firstTest)
  const second = secondTest === '' ? 0 : Number(secondTest)
  const finalExam = exam === '' ? 0 : Number(exam)
  const total = first + second + finalExam

  if (total >= 70) return { total, grade: 'A' }
  if (total >= 60) return { total, grade: 'B' }
  if (total >= 50) return { total, grade: 'C' }
  if (total >= 40) return { total, grade: 'D' }
  return { total, grade: 'F' }
}

const ResultsPage = () => {
  const { user, token } = useAuth()
  const [results, setResults] = useState<Result[]>([])
  
  // Base subjects fetched from teacher's backend
  const [subjects, setSubjects] = useState<SubjectRecord[]>([])
  
  // Selection states
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('')
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [academicYear, setAcademicYear] = useState('2024/2025')
  const [term, setTerm] = useState('First')
  
  // Single Entry Mode vs Batch Entry Mode
  const [viewMode, setViewMode] = useState<'VIEW' | 'BATCH' | 'SINGLE' | 'PDF'>('VIEW')
  
  // For batch/single entry
  const [classStudents, setClassStudents] = useState<ClassStudentEntry[]>([])
  const [batchData, setBatchData] = useState<Record<string, { firstTest: string, secondTest: string, exam: string }>>({})
  
  // Single mode state
  const [singleData, setSingleData] = useState({ studentId: '', firstTest: '', secondTest: '', exam: '' })
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfDocuments, setPdfDocuments] = useState<ResultDocument[]>([])
  
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [studentLoadError, setStudentLoadError] = useState<string | null>(null)
  const [teacherAssignmentSummary, setTeacherAssignmentSummary] = useState<null | {
    totalClasses: number
    totalSubjects: number
    totalStudents: number
    isClassTeacher: boolean
    classTeacherOf: string[]
  }>(null)
  const isDirector = user?.role === 'DIRECTOR'
  const isTeacher = user?.role === 'TEACHER'
  const canEditResults = user?.role === 'TEACHER' || user?.role === 'PRINCIPAL'

  useEffect(() => {
    fetchSubjects()
    if (user?.role === 'TEACHER') {
      fetchTeacherAssignmentSummary()
    }
  }, [])

  useEffect(() => {
    if (isDirector && viewMode !== 'VIEW') {
      setViewMode('VIEW')
      return
    }

    if (isTeacher && viewMode === 'VIEW') {
      setViewMode('PDF')
    }
  }, [isDirector, isTeacher, viewMode])

  // Derived state for dropdowns
  const validClasses = useMemo(() => {
    const classMap = new Map<string, { id: string, name: string, studentCount: number }>()
    subjects.filter(s => s.classId && s.class).forEach(s => {
      classMap.set(s.classId!, {
        id: s.class!.id,
        name: s.class!.name,
        studentCount: s.class!._count?.enrollments ?? 0
      })
    })
    return Array.from(classMap.values())
  }, [subjects])

  const filteredSubjects = useMemo(() => {
    if (!selectedClassId) return []
    return subjects.filter(s => s.classId === selectedClassId)
  }, [subjects, selectedClassId])

  const orphansCount = useMemo(() => subjects.filter(s => !s.classId).length, [subjects])

  // Sync explicitly selected class safely
  useEffect(() => {
    if (validClasses.length > 0 && !selectedClassId) {
      const defaultClass = isTeacher
        ? validClasses.find((classRecord) => classRecord.studentCount > 0) || validClasses[0]
        : validClasses[0]
      setSelectedClassId(defaultClass.id)
    }
  }, [validClasses, selectedClassId, isTeacher])

  // Sync safely explicitly filtered subjects when class changes
  useEffect(() => {
    if (filteredSubjects.length > 0) {
      // automatically pick first subject in this class if none selected or if old selection is invalid
      if (!selectedSubjectId || !filteredSubjects.find(s => s.id === selectedSubjectId)) {
        setSelectedSubjectId(filteredSubjects[0].id)
      }
    } else {
      setSelectedSubjectId('')
    }
  }, [filteredSubjects, selectedClassId])

  // Fetch logic dependent on finalized valid selection
  useEffect(() => {
    if (selectedClassId && selectedSubjectId) {
      if (viewMode === 'VIEW') fetchResults()
      if (viewMode === 'BATCH' || viewMode === 'SINGLE' || viewMode === 'PDF') fetchStudentsForEntry()
      if (viewMode === 'PDF') fetchResultDocuments()
    }
  }, [selectedClassId, selectedSubjectId, academicYear, term, viewMode])

  const fetchSubjects = async () => {
    setLoading(true)
    setError(null)
    try {
      const endpoint = user?.role === 'TEACHER' ? `${API_BASE}/api/teacher/my-subjects` : `${API_BASE}/api/subjects`
      
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      
      if (res.ok) {
        setSubjects(normalizeListPayload<SubjectRecord>(data, ['subjects', 'data', 'items']))
      } else {
        setError(data.error || 'Failed to sync subjects')
      }
    } catch (err) {
      console.error(err)
      setError('Network telemetry failure.')
    } finally {
       setLoading(false)
    }
  }

  const fetchTeacherAssignmentSummary = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/teacher/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setTeacherAssignmentSummary({
          totalClasses: data.totalClasses || 0,
          totalSubjects: data.totalSubjects || 0,
          totalStudents: data.totalStudents || 0,
          isClassTeacher: Boolean(data.isClassTeacher),
          classTeacherOf: Array.isArray(data.classTeacherOf) ? data.classTeacherOf : []
        })
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchResults = async () => {
    if (!selectedSubjectId || !selectedClassId) return
    setLoading(true)
    try {
      const url = `${API_BASE}/api/results?subjectId=${selectedSubjectId}&classId=${selectedClassId}&academicYear=${encodeURIComponent(academicYear)}&term=${term}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setResults(normalizeListPayload<Result>(data, ['results', 'data', 'items']))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchResultDocuments = async () => {
    if (!selectedSubjectId || !selectedClassId) return
    try {
      const params = new URLSearchParams({
        subjectId: selectedSubjectId,
        classId: selectedClassId,
        academicYear,
        term
      })
      const res = await fetch(`${API_BASE}/api/results/documents?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setPdfDocuments(normalizeListPayload<ResultDocument>(data, ['documents', 'data', 'items']))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchStudentsForEntry = async () => {
    if (!selectedClassId || !selectedSubjectId) return
    setLoading(true)
    setMessage(null)
    setStudentLoadError(null)
    try {
      let url = ''
      if (user?.role === 'TEACHER') {
        url = `${API_BASE}/api/teacher/my-students?classId=${selectedClassId}`
      } else {
        url = `${API_BASE}/api/enrollments?classId=${selectedClassId}`
      }

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const studentsPayload = await res.json()
      
      if (res.ok) {
        const students = normalizeListPayload<ClassStudentEntry>(studentsPayload, ['students', 'data', 'items'])
        setClassStudents(students)
        
        // Also fetch existing results to pre-populate both single and batch states correctly
        const resUrl = `${API_BASE}/api/results?subjectId=${selectedSubjectId}&classId=${selectedClassId}&academicYear=${encodeURIComponent(academicYear)}&term=${term}`
        const rRes = await fetch(resUrl, { headers: { Authorization: `Bearer ${token}` } })
        const existingResultsPayload = rRes.ok ? await rRes.json() : []
        const existingResults = normalizeListPayload<Result>(existingResultsPayload, ['results', 'data', 'items'])

        const initialBatchValues: Record<string, { firstTest: string; secondTest: string; exam: string }> = {}
        students.forEach((e) => {
          const sid = e.student.id
          const existing = existingResults.find((r) => r.student.id === sid)
          initialBatchValues[sid] = {
            firstTest: existing?.firstTest !== null && existing?.firstTest !== undefined ? String(existing.firstTest) : '',
            secondTest: existing?.secondTest !== null && existing?.secondTest !== undefined ? String(existing.secondTest) : '',
            exam: existing?.exam !== null && existing?.exam !== undefined ? String(existing.exam) : ''
          }
        })
        setBatchData(initialBatchValues)
        
        // Setup initial single data
        if (students.length > 0) {
           const firstStudent = students[0].student.id
           setSingleData({ 
             studentId: firstStudent, 
             firstTest: initialBatchValues[firstStudent]?.firstTest || '', 
             secondTest: initialBatchValues[firstStudent]?.secondTest || '', 
             exam: initialBatchValues[firstStudent]?.exam || '' 
           })
        } else {
          setSingleData({ studentId: '', firstTest: '', secondTest: '', exam: '' })
        }
      } else {
        setClassStudents([])
        setBatchData({})
        setSingleData({ studentId: '', firstTest: '', secondTest: '', exam: '' })
        setStudentLoadError(studentsPayload.error || 'Unable to load students for the selected class.')
      }
    } catch (err) {
      console.error(err)
      setClassStudents([])
      setBatchData({})
      setSingleData({ studentId: '', firstTest: '', secondTest: '', exam: '' })
      setStudentLoadError('Failed to load the class roster for result entry.')
    } finally {
      setLoading(false)
    }
  }

  const handleSingleStudentChange = (studentId: string) => {
     setSingleData({ 
       studentId, 
       firstTest: batchData[studentId]?.firstTest || '', 
       secondTest: batchData[studentId]?.secondTest || '', 
       exam: batchData[studentId]?.exam || '' 
     })
  }

  const handleBatchChange = (studentId: string, field: 'firstTest' | 'secondTest' | 'exam', value: string) => {
    setBatchData(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value }
    }))
  }

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClassId || !selectedSubjectId) return
    setSubmitting(true)
    setMessage(null)

    const resultsPayload = Object.entries(batchData).map(([studentId, scores]) => ({
      studentId,
      firstTest: scores.firstTest === '' ? null : Number(scores.firstTest),
      secondTest: scores.secondTest === '' ? null : Number(scores.secondTest),
      exam: scores.exam === '' ? null : Number(scores.exam)
    }))

    try {
      const res = await fetch(`${API_BASE}/api/results/batch`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          subjectId: selectedSubjectId,
          classId: selectedClassId,
          academicYear,
          term,
          results: resultsPayload
        })
      })

      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'success', text: data.message })
        setTimeout(() => {
          setViewMode('VIEW')
          fetchResults()
        }, 1500)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save results' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Network failure' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClassId || !selectedSubjectId) return
    setSubmitting(true)
    setMessage(null)

    try {
      const res = await fetch(`${API_BASE}/api/results`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          studentId: singleData.studentId,
          subjectId: selectedSubjectId,
          classId: selectedClassId,
          academicYear,
          term,
          firstTest: singleData.firstTest === '' ? null : Number(singleData.firstTest),
          secondTest: singleData.secondTest === '' ? null : Number(singleData.secondTest),
          exam: singleData.exam === '' ? null : Number(singleData.exam)
        })
      })

      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'success', text: 'Result saved successfully for student' })
        setTimeout(() => {
          setViewMode('VIEW')
          fetchResults()
        }, 1500)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save result' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Network failure' })
    } finally {
      setSubmitting(false)
    }
  }

  const handlePdfSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClassId || !selectedSubjectId || !singleData.studentId) {
      setMessage({ type: 'error', text: 'Select class, subject, and student before uploading a PDF.' })
      return
    }

    if (!pdfFile) {
      setMessage({ type: 'error', text: 'Choose a PDF file before uploading.' })
      return
    }

    if (pdfFile.type !== 'application/pdf' && !pdfFile.name.toLowerCase().endsWith('.pdf')) {
      setMessage({ type: 'error', text: 'Only PDF files are allowed.' })
      return
    }

    setSubmitting(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('classId', selectedClassId)
      formData.append('subjectId', selectedSubjectId)
      formData.append('studentId', singleData.studentId)
      formData.append('academicYear', academicYear)
      formData.append('term', term)
      formData.append('resultPdf', pdfFile)

      const res = await fetch(`${API_BASE}/api/results/documents/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      })

      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'success', text: data.message || 'Result PDF uploaded successfully.' })
        setPdfFile(null)
        const fileInput = document.getElementById('result-pdf-input') as HTMLInputElement | null
        if (fileInput) {
          fileInput.value = ''
        }
        fetchResultDocuments()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to upload result PDF.' })
      }
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Network failure while uploading result PDF.' })
    } finally {
      setSubmitting(false)
    }
  }

  const filteredResults = results.filter(r => 
    `${r.student.user.firstName} ${r.student.user.lastName} ${r.student.admissionNo}`.toLowerCase().includes(search.toLowerCase())
  )

  const activeSubject = subjects.find(s => s.id === selectedSubjectId)
  const activeClass = validClasses.find(c => c.id === selectedClassId)
  const activeStudent = classStudents.find((entry) => entry.student.id === singleData.studentId)
  const singlePreview = calculateTotalAndGrade(singleData.firstTest, singleData.secondTest, singleData.exam)
  const selectedClassRecord = subjects.find((subject) => subject.classId === selectedClassId)?.class
  const selectedClassStudentCount = selectedClassRecord?._count?.enrollments ?? classStudents.length
  const noSubjectAssignmentMessage = teacherAssignmentSummary?.isClassTeacher && teacherAssignmentSummary.totalSubjects === 0
    ? `You are assigned as class teacher for ${teacherAssignmentSummary.classTeacherOf.join(', ')}, but no subject has been assigned to you for result upload yet.`
    : 'You do not have any subject assignments linked to a class for result upload yet.'
  const noSubjectAssignmentHint = teacherAssignmentSummary?.isClassTeacher
    ? 'Result upload requires a subject that is linked to your class and assigned to you by the Director or Principal.'
    : 'Ask the Director or Principal to assign you a subject that is linked to a class before trying to upload results.'

  if (error) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center text-red-600 mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-2">Access Error</h2>
        <p className="text-slate-500 max-w-xs mb-6 font-medium">{error}</p>
        <button onClick={fetchSubjects} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold">Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight italic">
            {isDirector ? 'Results Reports' : 'Results Manager'}
          </h1>
          <p className="text-sm text-slate-500 font-medium tracking-tight">
            {isDirector
              ? 'Review uploaded results by class, subject, term, and student.'
              : isTeacher
                ? 'Upload first-term student results for your assigned class and subject.'
                : 'Upload and manage student examination records.'}
          </p>
        </div>
        
        {validClasses.length > 0 && canEditResults && (
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
             <button 
                onClick={() => setViewMode('VIEW')}
                className={`flex items-center gap-2 px-4 py-2 font-black uppercase tracking-widest text-xs rounded-lg transition-all ${viewMode === 'VIEW' ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                View Results
             </button>
             <button 
                onClick={() => setViewMode('PDF')}
                className={`flex items-center gap-2 px-4 py-2 font-black uppercase tracking-widest text-xs rounded-lg transition-all ${viewMode === 'PDF' ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Upload Result PDF
             </button>
             <button 
                onClick={() => setViewMode('SINGLE')}
                className={`flex items-center gap-2 px-4 py-2 font-black uppercase tracking-widest text-xs rounded-lg transition-all ${viewMode === 'SINGLE' ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Score Entry
             </button>
             <button 
                onClick={() => setViewMode('BATCH')}
                className={`flex items-center gap-2 px-4 py-2 font-black uppercase tracking-widest text-xs rounded-lg transition-all ${viewMode === 'BATCH' ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Batch Upload
             </button>
          </div>
        )}
      </div>

      {orphansCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-4 rounded-xl flex items-start gap-3">
           <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
           <div>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-200">Invalid Subjects Detected</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{orphansCount} of your assigned subjects are missing a valid Class Linkage from the Administrator. They have been hidden from this form to preserve data integrity.</p>
           </div>
        </div>
      )}

      {validClasses.length === 0 && !loading ? (
        <div className="p-16 bg-white dark:bg-slate-900 rounded-[2.5rem] text-center border border-slate-100 dark:border-slate-800">
           <div className="p-5 bg-slate-50 dark:bg-slate-800 rounded-full w-fit mx-auto mb-4">
             <BookOpen size={32} className="text-slate-400" />
           </div>
           <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 italic">
             {isTeacher ? 'No Subject Assignment For Result Upload' : 'No Valid Classes Found'}
           </h3>
           <p className="text-sm text-slate-500 font-medium max-w-xl mx-auto mt-2">
             {isTeacher ? noSubjectAssignmentMessage : 'You have not been assigned to any valid classes. Admin must map your subjects to a specific class for result uploads.'}
           </p>
           {isTeacher && (
             <p className="text-xs text-slate-400 font-medium max-w-xl mx-auto mt-3">
               {noSubjectAssignmentHint}
             </p>
           )}
           {isTeacher && teacherAssignmentSummary && (
             <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600">
               <span>My Classes: {teacherAssignmentSummary.totalClasses}</span>
               <span>My Subjects: {teacherAssignmentSummary.totalSubjects}</span>
               <span>My Students: {teacherAssignmentSummary.totalStudents}</span>
             </div>
           )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm items-end">
            <div className="space-y-1.5 flex-[2]">
              <label className="text-[10px] font-black text-brand-600 uppercase tracking-widest ml-1 flex items-center gap-1"><School size={12}/> Select Class</label>
              <select 
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-4 py-3 bg-brand-50/60 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border-none rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-black"
              >
                {validClasses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {isTeacher ? ` (${c.studentCount} students)` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 flex-[2]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Subject</label>
              <select 
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border-none rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-bold"
                disabled={filteredSubjects.length === 0}
              >
                {filteredSubjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 flex-1 min-w-[150px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Academic Year</label>
              <input 
                type="text" 
                value={academicYear}
                onChange={e => setAcademicYear(e.target.value)}
                placeholder="2024/2025"
                className="w-full px-4 py-3 bg-slate-50 text-slate-900 placeholder:text-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 border-none rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-bold"
              />
            </div>
            <div className="space-y-1.5 flex-1 min-w-[150px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Term</label>
              <select 
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border-none rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-bold"
              >
                <option value="First">First Term</option>
                <option value="Second">Second Term</option>
                <option value="Third">Third Term</option>
              </select>
            </div>
          </div>

          {viewMode === 'VIEW' && (
             <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text"
                    placeholder={`Search within ${activeSubject?.name || 'records'}...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 text-slate-900 placeholder:text-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 border-none rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-bold"
                  />
                </div>
              </div>
              
              {loading ? (
                <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-brand-600" size={32} /></div>
              ) : filteredResults.length === 0 ? (
                <div className="p-16 text-center text-slate-500 font-bold italic text-sm border-t-2 border-dashed border-slate-100">No results found for {activeSubject?.name || 'this selection'}.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Student</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">First Test</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Second Test</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Exam</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                      {filteredResults.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{r.student.user.firstName} {r.student.user.lastName}</p>
                            <p className="text-xs text-slate-400 font-medium font-mono">{r.student.admissionNo}</p>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-600 text-right">{r.firstTest ?? '-'}</td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-600 text-right">{r.secondTest ?? '-'}</td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-600 text-right">{r.exam ?? '-'}</td>
                          <td className="px-6 py-4 text-sm font-black text-slate-900 dark:text-slate-100 text-right">{r.total ?? '-'}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-block px-3 py-1 rounded-lg text-xs font-black w-10 text-center ${
                              r.grade === 'A' ? 'bg-emerald-100 text-emerald-700' :
                              r.grade === 'B' ? 'bg-brand-100 text-brand-700' :
                              r.grade === 'C' ? 'bg-amber-100 text-amber-700' :
                              r.grade === 'D' ? 'bg-orange-100 text-orange-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {r.grade || '-'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {viewMode === 'PDF' && canEditResults && (
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm p-6 sm:p-10 max-w-4xl mx-auto">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-brand-50 dark:bg-brand-500/10 rounded-2xl text-brand-600">
                  <Upload size={26} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 italic">Upload Student Result PDF</h2>
                  <p className="text-xs text-slate-400 font-black uppercase tracking-widest">
                    {activeSubject?.name} - {activeClass?.name} - {term} Term - {academicYear}
                  </p>
                </div>
              </div>

              {message && (
                 <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold animate-in mb-6 ${
                   message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                 }`}>
                   {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                   {message.text}
                 </div>
              )}

              {loading ? (
                 <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-brand-600" size={32} /></div>
              ) : classStudents.length === 0 ? (
                <div className="p-10 text-center text-slate-500 font-bold border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl italic space-y-3">
                  <p>{studentLoadError || `No students are enrolled in ${activeClass?.name} yet.`}</p>
                  <p className="text-xs font-medium not-italic text-slate-400">
                    Select a class with enrolled students, or add students first before uploading a result PDF.
                  </p>
                  {isTeacher && (
                    <Link
                      to="/dashboard/my-students"
                      className="inline-flex items-center rounded-xl bg-brand-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-brand-700 not-italic"
                    >
                      Open My Students
                    </Link>
                  )}
                </div>
              ) : (
                <form onSubmit={handlePdfSubmit} className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-4 text-slate-900">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Select Class</p>
                      <p className="mt-2 text-sm font-black text-slate-900">{activeClass?.name || 'No class selected'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-4 text-slate-900">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Select Subject</p>
                      <p className="mt-2 text-sm font-black text-slate-900">{activeSubject?.name || 'No subject selected'}</p>
                    </div>
                    <div className="rounded-2xl border border-brand-200 bg-brand-50/70 px-4 py-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-brand-600">Term</p>
                      <p className="mt-2 text-sm font-black text-brand-900">{term} Term</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-4 text-slate-900">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Academic Year</p>
                      <p className="mt-2 text-sm font-black text-slate-900">{academicYear}</p>
                    </div>
                  </div>

                  <div className="space-y-2 relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Student</label>
                    <select
                      value={singleData.studentId}
                      onChange={(e) => handleSingleStudentChange(e.target.value)}
                      required
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border-none rounded-xl outline-none focus:ring-2 focus:ring-brand-500 font-bold"
                    >
                      {classStudents.map((entry) => (
                        <option key={entry.student.id} value={entry.student.id}>
                          {entry.student.user.firstName} {entry.student.user.lastName} ({entry.student.admissionNo})
                        </option>
                      ))}
                    </select>
                    <UserCheck className="absolute left-4 top-[38px] text-slate-400" size={20} />
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-4 text-slate-900">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Result Owner</p>
                    <p className="mt-2 text-base font-black text-slate-900">
                      {activeStudent ? `${activeStudent.student.user.firstName} ${activeStudent.student.user.lastName}` : 'Select a student'}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Admission No: {activeStudent?.student.admissionNo || '-'}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Class: {activeClass?.name || '-'} • Term: {term} Term • Session: {academicYear}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="result-pdf-input" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Upload PDF Result
                    </label>
                    <input
                      id="result-pdf-input"
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                      className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-900 file:mr-4 file:rounded-xl file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-xs file:font-black file:uppercase file:tracking-widest file:text-white hover:file:bg-brand-700"
                    />
                    <p className="text-xs text-slate-500">
                      Upload only a PDF file. If a PDF already exists for this student, subject, class, term, and academic year, the new upload replaces it.
                    </p>
                    {pdfFile && (
                      <p className="text-xs font-bold text-brand-700">Selected file: {pdfFile.name}</p>
                    )}
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button disabled={submitting} type="submit" className="bg-brand-600 hover:bg-brand-700 text-white px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all w-full sm:w-auto">
                      {submitting ? <Loader2 size={18} className="animate-spin" /> : <><Upload size={18} /> Upload Result PDF</>}
                    </button>
                  </div>
                </form>
              )}

              {pdfDocuments.length > 0 && (
                <div className="mt-8 border-t border-slate-100 pt-6 dark:border-slate-800">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Recently Uploaded PDFs</h3>
                  <div className="mt-4 space-y-3">
                    {pdfDocuments.slice(0, 5).map((document) => (
                      <div key={document.id} className="rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-4">
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">{document.originalFileName}</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">{document.term} Term • {document.academicYear}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {viewMode === 'BATCH' && canEditResults && (
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm p-6 sm:p-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-brand-50 dark:bg-brand-500/10 rounded-2xl text-brand-600">
                  <FileCheck size={26} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 italic">Batch Upload Results</h2>
                  <p className="text-xs text-slate-400 font-black uppercase tracking-widest">{activeSubject?.name} - {activeClass?.name} - {term} Term</p>
                </div>
              </div>

              {message && (
                 <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold animate-in mb-6 ${
                   message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                 }`}>
                   {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                   {message.text}
                 </div>
              )}

              {loading ? (
                 <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-brand-600" size={32} /></div>
              ) : classStudents.length === 0 ? (
                <div className="p-10 text-center text-slate-500 font-bold border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl italic space-y-3">
                  <p>{studentLoadError || `No students are enrolled in ${activeClass?.name} yet.`}</p>
                  <p className="text-xs font-medium not-italic text-slate-400">
                    Add or enroll students into this class before using batch result upload.
                  </p>
                  {isTeacher && (
                    <Link
                      to="/dashboard/my-students"
                      className="inline-flex items-center rounded-xl bg-brand-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-brand-700 not-italic"
                    >
                      Open My Students
                    </Link>
                  )}
                </div>
              ) : (
                <form onSubmit={handleBatchSubmit}>
                  <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden mb-8">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
                         <tr>
                           <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-widest w-1/3">Student</th>
                           <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-widest text-center">First Test</th>
                           <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-widest text-center">Second Test</th>
                           <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-widest text-center">Exam</th>
                           <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-widest text-center">Total</th>
                           <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-widest text-center">Grade</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                         {classStudents.map(e => {
                           const sid = e.student.id
                           const preview = calculateTotalAndGrade(
                             batchData[sid]?.firstTest || '',
                             batchData[sid]?.secondTest || '',
                             batchData[sid]?.exam || ''
                           )
                           return (
                             <tr key={sid} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                               <td className="px-6 py-4">
                                 <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{e.student.user.firstName} {e.student.user.lastName}</p>
                                 <p className="text-xs text-slate-400 font-medium">{e.student.admissionNo}</p>
                               </td>
                               <td className="px-4 py-3">
                                  <input 
                                    type="number" 
                                    min="0" max="20"
                                    value={batchData[sid]?.firstTest || ''} 
                                    onChange={(e) => handleBatchChange(sid, 'firstTest', e.target.value)}
                                    className="w-full px-3 py-2 text-center bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-brand-500 font-bold"
                                  />
                               </td>
                               <td className="px-4 py-3">
                                  <input 
                                    type="number" 
                                    min="0" max="20"
                                    value={batchData[sid]?.secondTest || ''} 
                                    onChange={(e) => handleBatchChange(sid, 'secondTest', e.target.value)}
                                    className="w-full px-3 py-2 text-center bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-brand-500 font-bold"
                                  />
                               </td>
                               <td className="px-4 py-3">
                                  <input 
                                    type="number" 
                                    min="0" max="60"
                                    value={batchData[sid]?.exam || ''} 
                                    onChange={(e) => handleBatchChange(sid, 'exam', e.target.value)}
                                    className="w-full px-3 py-2 text-center bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-brand-500 font-bold"
                                  />
                               </td>
                               <td className="px-4 py-3 text-center text-sm font-black text-slate-900 dark:text-slate-100">{preview.total}</td>
                               <td className="px-4 py-3 text-center">
                                 <span className="inline-flex min-w-10 justify-center rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                   {preview.grade}
                                 </span>
                               </td>
                             </tr>
                           )
                         })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end">
                    <button disabled={submitting} type="submit" className="bg-brand-600 hover:bg-brand-700 text-white px-8 py-3 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all">
                      {submitting ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle2 size={18} /> Save Batch Results</>}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {viewMode === 'SINGLE' && canEditResults && (
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm p-6 sm:p-10 max-w-3xl mx-auto">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-brand-50 dark:bg-brand-500/10 rounded-2xl text-brand-600">
                  <UserCheck size={26} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 italic">Upload Student Result</h2>
                  <p className="text-xs text-slate-400 font-black uppercase tracking-widest">{activeSubject?.name} - {activeClass?.name} - {term} Term</p>
                </div>
              </div>

              {message && (
                 <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold animate-in mb-6 ${
                   message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                 }`}>
                   {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                   {message.text}
                 </div>
              )}

              {loading ? (
                 <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-brand-600" size={32} /></div>
              ) : classStudents.length === 0 ? (
                <div className="p-10 text-center text-slate-500 font-bold border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl italic space-y-3">
                  <p>{studentLoadError || `No students are enrolled in ${activeClass?.name} yet.`}</p>
                  <p className="text-xs font-medium not-italic text-slate-400">
                    Select a class with enrolled students, or add students first before uploading a result.
                  </p>
                  {isTeacher && (
                    <Link
                      to="/dashboard/my-students"
                      className="inline-flex items-center rounded-xl bg-brand-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-brand-700 not-italic"
                    >
                      Open My Students
                    </Link>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSingleSubmit} className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Select Class</p>
                      <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{activeClass?.name || 'No class selected'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Select Subject</p>
                      <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{activeSubject?.name || 'No subject selected'}</p>
                    </div>
                    <div className="rounded-2xl border border-brand-200 bg-brand-50/70 px-4 py-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-brand-600">Term</p>
                      <p className="mt-2 text-sm font-black text-brand-900">{term} Term</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Students Available</p>
                    <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{selectedClassStudentCount}</p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Results can only be saved for students enrolled in the selected class.
                    </p>
                  </div>

                  <div className="space-y-2 relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Student</label>
                    <select 
                      value={singleData.studentId}
                      onChange={(e) => handleSingleStudentChange(e.target.value)}
                      required
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-brand-500 font-bold"
                    >
                      {classStudents.map(e => (
                        <option key={e.student.id} value={e.student.id}>
                          {e.student.user.firstName} {e.student.user.lastName} ({e.student.admissionNo})
                        </option>
                      ))}
                    </select>
                    <UserCheck className="absolute left-4 top-[38px] text-slate-400" size={20} />
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Result Owner</p>
                    <p className="mt-2 text-base font-black text-slate-900 dark:text-slate-100">
                      {activeStudent ? `${activeStudent.student.user.firstName} ${activeStudent.student.user.lastName}` : 'Select a student'}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Admission No: {activeStudent?.student.admissionNo || '-'}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">First Test</label>
                       <input 
                         type="number" min="0" max="20"
                         value={singleData.firstTest}
                         onChange={(e) => setSingleData(p => ({ ...p, firstTest: e.target.value }))}
                         className="w-full px-4 py-4 bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-brand-500 font-bold text-center text-lg"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Second Test</label>
                       <input 
                         type="number" min="0" max="20"
                         value={singleData.secondTest}
                         onChange={(e) => setSingleData(p => ({ ...p, secondTest: e.target.value }))}
                         className="w-full px-4 py-4 bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-brand-500 font-bold text-center text-lg"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Exam</label>
                       <input 
                         type="number" min="0" max="60"
                         value={singleData.exam}
                         onChange={(e) => setSingleData(p => ({ ...p, exam: e.target.value }))}
                         className="w-full px-4 py-4 bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-brand-500 font-bold text-center text-lg"
                       />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total</p>
                      <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{singlePreview.total}</p>
                    </div>
                    <div className="rounded-2xl border border-brand-200 bg-brand-50/70 px-4 py-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-brand-600">Grade</p>
                      <p className="mt-2 text-2xl font-black text-brand-900">{singlePreview.grade}</p>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button disabled={submitting} type="submit" className="bg-brand-600 hover:bg-brand-700 text-white px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all w-full sm:w-auto">
                      {submitting ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle2 size={18} /> Save Result</>}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

        </>
      )}
    </div>
  )
}

export default ResultsPage
