type AiHelpInput = {
  role: string
  question: string
  currentPage?: string | null
}

type AssistantInput = {
  subject: string
  latestUserMessage: string
  role: string
}

const OUT_OF_SCOPE_REPLY =
  'I can help with how to use this school management platform only. For non-platform questions, please use another assistant. If you need product help, open Support in your dashboard and submit a support request.'
const SUPPORT_FALLBACK =
  'I could not fully resolve this from the assistant. Please contact support from your Support page or email support@nexdu.com with your school name, role, and screenshot.'

const QUICK_ACTIONS = {
  ADD_TEACHER: 'Add Teacher',
  UPLOAD_RESULT: 'Upload Result',
  MARK_ATTENDANCE: 'Mark Attendance',
  ADD_STUDENT: 'Add Student',
  VIEW_RESULT: 'View Result',
} as const

function normalize(text: string) {
  return text.toLowerCase().trim()
}

function hasAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

function buildSteps(title: string, steps: string[], footer?: string) {
  const numbered = steps.map((step, index) => `${index + 1}. ${step}`).join('\n')
  return `${title}\n${numbered}${footer ? `\n${footer}` : ''}`
}

function detectIntent(text: string) {
  if (hasAny(text, ['add principal', 'add a principal', 'create principal'])) return 'ADD_PRINCIPAL'
  if (hasAny(text, ['add teacher', 'add a teacher', 'create teacher', 'teacher account'])) return 'ADD_TEACHER'
  if (hasAny(text, ['add student', 'add a student', 'create student', 'admission'])) return 'ADD_STUDENT'
  if (hasAny(text, ['create class', 'add class', 'manage class'])) return 'CLASSES'
  if (hasAny(text, ['create subject', 'add subject', 'manage subject'])) return 'SUBJECTS'
  if (hasAny(text, ['attendance', 'mark attendance'])) return 'ATTENDANCE'
  if (hasAny(text, ['upload result', 'edit result', 'result entry'])) return 'RESULTS'
  if (hasAny(text, ['pdf result', 'upload pdf', 'result pdf'])) return 'PDF_RESULTS'
  if (hasAny(text, ['view result', 'cannot see result', 'can not see result'])) return 'VIEW_RESULT'
  if (hasAny(text, ['print result', 'result slip'])) return 'RESULT_SLIP'
  if (hasAny(text, ['renew subscription', 'subscription', 'payment'])) return 'SUBSCRIPTION'
  if (hasAny(text, ['trial expired', 'expired trial', 'trial'])) return 'TRIAL'
  if (hasAny(text, ['school logo', 'upload logo'])) return 'LOGO'
  if (hasAny(text, ['school settings', 'school profile', 'settings'])) return 'SETTINGS'
  if (hasAny(text, ['login', 'cannot login', 'can not login', 'otp', 'password'])) return 'LOGIN'
  if (hasAny(text, ['notice', 'notification'])) return 'NOTICES'
  return null
}

function detectPageIntent(page: string) {
  const normalizedPage = normalize(page || '')
  if (hasAny(normalizedPage, ['students page', '/dashboard/students', 'students'])) return 'ADD_STUDENT'
  if (hasAny(normalizedPage, ['teachers page', '/dashboard/teachers', 'teachers'])) return 'ADD_TEACHER'
  if (hasAny(normalizedPage, ['results page', '/dashboard/results', 'results'])) return 'RESULTS'
  if (hasAny(normalizedPage, ['attendance page', '/dashboard/attendance', 'attendance'])) return 'ATTENDANCE'
  return null
}

function roleAllowsIntent(role: string, intent: string) {
  const upperRole = role.toUpperCase()
  if (upperRole === 'DIRECTOR' || upperRole === 'PRINCIPAL') return true

  const principalAllowed = new Set([
    'ADD_TEACHER',
    'ADD_STUDENT',
    'CLASSES',
    'SUBJECTS',
    'ATTENDANCE',
    'NOTICES',
    'SETTINGS',
    'VIEW_RESULT',
  ])

  const teacherAllowed = new Set([
    'ATTENDANCE',
    'RESULTS',
    'PDF_RESULTS',
    'VIEW_RESULT',
    'NOTICES',
  ])

  const studentAllowed = new Set([
    'LOGIN',
    'VIEW_RESULT',
    'RESULT_SLIP',
    'ATTENDANCE',
    'PDF_RESULTS',
    'NOTICES',
  ])

  if (upperRole === 'TEACHER') return teacherAllowed.has(intent)
  if (upperRole === 'STUDENT') return studentAllowed.has(intent)
  return false
}

function roleCapabilityHint(role: string) {
  const upperRole = role.toUpperCase()
  if (upperRole === 'DIRECTOR' || upperRole === 'PRINCIPAL') {
    return 'As Director, you can add teachers and manage core school setup from your dashboard.'
  }
  if (upperRole === 'TEACHER') {
    return 'As Teacher, you can upload results and mark attendance.'
  }
  if (upperRole === 'STUDENT') {
    return 'As Student, you can view your results.'
  }
  return 'I can guide you based on your current role permissions.'
}

function quickActionsForIntent(role: string, intent: string) {
  const upperRole = role.toUpperCase()
  if (upperRole === 'DIRECTOR' || upperRole === 'PRINCIPAL') {
    if (intent === 'ADD_TEACHER' || intent === 'ADD_STUDENT') {
      return [QUICK_ACTIONS.ADD_TEACHER, QUICK_ACTIONS.ADD_STUDENT, QUICK_ACTIONS.MARK_ATTENDANCE]
    }
    return [QUICK_ACTIONS.ADD_TEACHER, QUICK_ACTIONS.UPLOAD_RESULT, QUICK_ACTIONS.MARK_ATTENDANCE]
  }
  if (upperRole === 'TEACHER') return [QUICK_ACTIONS.UPLOAD_RESULT, QUICK_ACTIONS.MARK_ATTENDANCE, QUICK_ACTIONS.VIEW_RESULT]
  if (upperRole === 'STUDENT') return [QUICK_ACTIONS.VIEW_RESULT]
  return [QUICK_ACTIONS.ADD_TEACHER, QUICK_ACTIONS.UPLOAD_RESULT, QUICK_ACTIONS.MARK_ATTENDANCE]
}

function buildIntentReply(role: string, intent: string) {
  const upperRole = role.toUpperCase()
  switch (intent) {
    case 'ADD_PRINCIPAL':
      return buildSteps('How to add a principal', [
        'Open the Director dashboard.',
        'Go to the Principals section.',
        'Click Add Principal and fill the profile details.',
        'Save and confirm the account appears in the list.',
      ])
    case 'ADD_TEACHER':
      return buildSteps('How to add a teacher', [
        `Open the ${upperRole === 'DIRECTOR' ? 'Director' : 'Principal'} dashboard.`,
        'Go to the Teachers section.',
        'Click Add Teacher, enter the teacher information, then save.',
        'Check the teacher list to confirm the record is active.',
      ])
    case 'ADD_STUDENT':
      return buildSteps('How to add a student', [
        `Open the ${upperRole === 'DIRECTOR' ? 'Director' : 'Principal'} dashboard.`,
        'Go to the Students section and click Add Student.',
        'Enter the required details including class and admission number.',
        'Save and verify the student now appears in the student list.',
      ])
    case 'CLASSES':
      return buildSteps('How to create classes', [
        'Open Classes in your dashboard.',
        'Click Add Class and provide class level/name details.',
        'Save the class and confirm it appears in the class table.',
      ])
    case 'SUBJECTS':
      return buildSteps('How to create subjects', [
        'Open Subjects in your dashboard.',
        'Click Add Subject and enter subject details.',
        'Assign class/teacher where required, then save.',
      ])
    case 'ATTENDANCE':
      return buildSteps('How to mark attendance', [
        'Open Attendance in your dashboard.',
        'Select the class/date and correct attendance target.',
        'Mark each learner/staff status and submit.',
        'Use the same attendance date when updating an existing day record.',
      ])
    case 'RESULTS':
      return buildSteps('How to upload or edit results', [
        'Open the Results module in the Teacher dashboard.',
        'Select the correct class, subject, term, and session/year.',
        'Enter test/exam values, then save.',
        'Use edit/update in the same record context for corrections.',
      ])
    case 'PDF_RESULTS':
      return buildSteps('How to upload or view PDF results', [
        'Open the PDF Results area in your dashboard.',
        'Pick the correct student/class/term/session context.',
        'Choose the PDF file and upload.',
        'After upload, open the document from the same student result view.',
      ], 'If upload fails, confirm the file is a valid PDF and that your role has permission.')
    case 'VIEW_RESULT':
      return buildSteps('Why a result may not be visible', [
        'Confirm result data was uploaded for the exact term and academic year.',
        'Confirm the student is viewing their own account.',
        'Check that the school access is active (trial/subscription not expired).',
        'If still missing, open Support and include student name, class, and term.',
      ])
    case 'RESULT_SLIP':
      return buildSteps('How to print result slip', [
        'Open your Results page as the student.',
        'Choose the term/session result you want to print.',
        'Use the print result slip button in the result view.',
        'Confirm the browser print preview opens, then print or save PDF.',
      ])
    case 'SUBSCRIPTION':
      return buildSteps('How to renew subscription', [
        'Open Subscription Plan from the dashboard.',
        'Select the target term plan (First, Second, or Third Term).',
        'Proceed to payment and complete checkout.',
        'After successful verification, access updates automatically at school level.',
      ])
    case 'TRIAL':
      return buildSteps('What to do when trial is expired', [
        'Trial is school-level and ends automatically after its duration.',
        'Director should open Subscription Plan.',
        'Complete a valid term subscription payment to restore full access.',
      ])
    case 'LOGO':
      return buildSteps('How to upload school logo', [
        'Open Settings or School Profile.',
        'Use the logo upload control and choose a valid image file.',
        'Save changes and refresh profile preview if needed.',
      ])
    case 'SETTINGS':
      return buildSteps('How to update school settings/profile', [
        'Open Settings from the dashboard.',
        'Update the required school profile fields.',
        'Save and confirm updates reflect on the profile area.',
      ])
    case 'LOGIN':
      return buildSteps('How to resolve login issues', [
        'Confirm email and password are correct.',
        'If needed, use Forgot Password to reset credentials.',
        'For new school registration, complete OTP verification first.',
        'If access is still blocked, check school subscription/trial status.',
      ])
    case 'NOTICES':
      return buildSteps('How to use notices/notifications', [
        'Open the Notices or Notifications area in your dashboard.',
        'Review new notices and mark read where available.',
        'Directors/Principals can publish notices based on role permissions.',
      ])
    default:
      return 'I can help with attendance, results, PDF uploads, notices, settings, and subscription guidance in this platform. Please ask a specific workflow question.'
  }
}

export function generatePlatformHelpReply(input: AiHelpInput) {
  const combined = normalize(`${input.currentPage || ''} ${input.question || ''}`)
  if (!combined) {
    return {
      answer: 'Please share your question about using this platform and I will guide you step by step.',
      inScope: true,
      supportMessage: SUPPORT_FALLBACK,
      quickActions: quickActionsForIntent(input.role, 'ADD_TEACHER'),
    }
  }

  const detectedIntent = detectIntent(combined)
  const pageIntent = detectPageIntent(input.currentPage || '')
  const intent = detectedIntent || pageIntent
  if (!intent) {
    return {
      answer: OUT_OF_SCOPE_REPLY,
      inScope: false,
      supportMessage: SUPPORT_FALLBACK,
      quickActions: quickActionsForIntent(input.role, 'ADD_TEACHER'),
    }
  }

  if (!roleAllowsIntent(input.role, intent)) {
    return {
      answer: `${roleCapabilityHint(input.role)}\nThis action is not available for your current role. If you need access changes, contact your school administrator through Support.`,
      inScope: true,
      supportMessage: SUPPORT_FALLBACK,
      quickActions: quickActionsForIntent(input.role, intent),
    }
  }

  return {
    answer: `${roleCapabilityHint(input.role)}\n\n${buildIntentReply(input.role, intent)}`,
    inScope: true,
    intent,
    supportMessage: SUPPORT_FALLBACK,
    quickActions: quickActionsForIntent(input.role, intent),
  }
}

export function generateSupportAssistantReply(input: AssistantInput) {
  return generatePlatformHelpReply({
    role: input.role,
    question: `${input.subject}\n${input.latestUserMessage}`,
    currentPage: 'support thread',
  }).answer
}
