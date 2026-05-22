import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const serverDir = path.resolve(__dirname, '..')
const apiBase = 'http://localhost:5000'
const prisma = new PrismaClient()

const now = Date.now()
const suffix = String(now).slice(-6)

const users = {
  director: {
    email: `qa.director.${suffix}@example.com`,
    password: 'Password123!',
  },
  principal: {
    email: `qa.principal.${suffix}@example.com`,
    password: 'Password123!',
  },
  teacher: {
    email: `qa.teacher.${suffix}@example.com`,
    password: 'Password123!',
  },
  student: {
    email: `qa.student.${suffix}@example.com`,
    password: 'Password123!',
  },
}

const report = {
  otpRegistration: { status: 'NOT_RUN', notes: [] },
  paymentCallback: { status: 'NOT_RUN', notes: [] },
  activeLoginAfterPayment: { status: 'NOT_RUN', notes: [] },
  refreshPersistence: { status: 'NOT_RUN', notes: [] },
  directorCrud: { status: 'NOT_RUN', notes: [] },
  principalCrud: { status: 'NOT_RUN', notes: [] },
  teacherResultsPdfUpload: { status: 'NOT_RUN', notes: [] },
  studentResultSlipPdfViewPrint: { status: 'NOT_RUN', notes: [] },
  subscriptionExpiryRenewal: { status: 'NOT_RUN', notes: [] },
  noticesNotifications: { status: 'NOT_RUN', notes: [] },
}

let ctx = {
  directorToken: null,
  principalToken: null,
  teacherToken: null,
  studentToken: null,
  schoolId: null,
  directorUserId: null,
  principalUserId: null,
  teacherUserId: null,
  teacherStaffId: null,
  classId: null,
  subjectId: null,
  studentUserId: null,
  studentProfileId: null,
  noticeId: null,
  resultDocId: null,
  resultId: null,
  paymentReference: null,
}

function note(key, message) {
  report[key].notes.push(message)
}

function setStatus(key, status) {
  report[key].status = status
}

function toJsonSafe(value) {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function normalizeListPayload(data, candidateKeys = []) {
  if (Array.isArray(data)) return data
  if (!data || typeof data !== 'object') return []

  for (const key of candidateKeys) {
    if (Array.isArray(data[key])) return data[key]
  }

  for (const value of Object.values(data)) {
    if (Array.isArray(value)) return value
  }

  return []
}

async function apiRequest(method, pathname, { token, body, headers } = {}) {
  const requestHeaders = {
    ...(headers || {}),
  }

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`
  }

  let payload = undefined
  if (body !== undefined) {
    if (body instanceof FormData) {
      payload = body
    } else {
      requestHeaders['Content-Type'] = 'application/json'
      payload = JSON.stringify(body)
    }
  }

  const response = await fetch(`${apiBase}${pathname}`, {
    method,
    headers: requestHeaders,
    body: payload,
  })

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    headers: response.headers,
  }
}

async function waitForHealth(timeoutMs = 30000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await apiRequest('GET', '/api/health')
      if (res.ok) return true
    } catch {
      // ignore
    }
    await delay(800)
  }
  return false
}

async function loginAndStore(role, email, password) {
  const loginRes = await apiRequest('POST', '/api/auth/login', {
    body: { email, password },
  })
  if (!loginRes.ok || !loginRes.data?.token) {
    return { ok: false, response: loginRes }
  }
  if (role === 'DIRECTOR') ctx.directorToken = loginRes.data.token
  if (role === 'PRINCIPAL') ctx.principalToken = loginRes.data.token
  if (role === 'TEACHER') ctx.teacherToken = loginRes.data.token
  if (role === 'STUDENT') ctx.studentToken = loginRes.data.token
  return { ok: true, response: loginRes }
}

async function ensureActiveSubscriptionForSchool(schoolId) {
  if (!schoolId) return

  const now = new Date()
  const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  await prisma.subscription.create({
    data: {
      schoolId,
      planName: 'TERM_SUBSCRIPTION',
      termName: 'First Term',
      amount: 200000,
      startDate: now,
      endDate,
      status: 'ACTIVE',
      paymentReference: `QA-ACTIVE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    },
  })

  await prisma.school.update({
    where: { id: schoolId },
    data: { status: 'ACTIVE' },
  })
}

async function run() {
  const server = spawn('node', ['dist/index.js'], {
    cwd: serverDir,
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''
  server.stdout.on('data', chunk => {
    stdout += chunk.toString()
  })
  server.stderr.on('data', chunk => {
    stderr += chunk.toString()
  })

  try {
    const ready = await waitForHealth()
    if (!ready) {
      throw new Error('Server did not become healthy in time')
    }

    // 1) OTP registration
    const registerRes = await apiRequest('POST', '/api/auth/register', {
      body: {
        schoolName: `QA School ${suffix}`,
        email: users.director.email,
        password: users.director.password,
        directorFullName: 'QA Director',
        phone: '08012345678',
        address: 'QA Street, Lagos',
      },
    })

    if (!registerRes.ok) {
      setStatus('otpRegistration', 'FAIL')
      note('otpRegistration', `Register failed (${registerRes.status}): ${toJsonSafe(registerRes.data)}`)
    } else {
      const otp = registerRes.data?.debug?.otpCode
      note('otpRegistration', `Register accepted (${registerRes.status}) for ${users.director.email}`)
      if (!otp) {
        setStatus('otpRegistration', 'PARTIAL')
        note('otpRegistration', 'OTP debug code missing; cannot verify OTP automatically in this run.')
      } else {
        const verifyRes = await apiRequest('POST', '/api/auth/verify-registration-otp', {
          body: {
            email: users.director.email,
            otpCode: otp,
          },
        })
        if (!verifyRes.ok) {
          setStatus('otpRegistration', 'FAIL')
          note('otpRegistration', `OTP verify failed (${verifyRes.status}): ${toJsonSafe(verifyRes.data)}`)
        } else {
          setStatus('otpRegistration', 'PASS')
          note('otpRegistration', `OTP verified (${verifyRes.status})`)
          if (verifyRes.data?.reference) {
            ctx.paymentReference = verifyRes.data.reference
          }
        }
      }
    }

    // 2) Payment callback
    if (!ctx.paymentReference) {
      setStatus('paymentCallback', 'PARTIAL')
      note('paymentCallback', 'No payment reference from OTP verify, payment callback not fully testable.')
    } else {
      const verifyPaymentRes = await apiRequest('GET', `/api/payments/verify/${ctx.paymentReference}`)
      if (verifyPaymentRes.ok) {
        setStatus('paymentCallback', 'PASS')
        note('paymentCallback', 'Payment verification endpoint succeeded.')
      } else {
        setStatus('paymentCallback', 'PARTIAL')
        note('paymentCallback', `Payment verify returned ${verifyPaymentRes.status}: ${toJsonSafe(verifyPaymentRes.data)}`)
      }
    }

    // 3) Active login after payment
    const loginAfterOtp = await apiRequest('POST', '/api/auth/login', {
      body: { email: users.director.email, password: users.director.password },
    })
    if (loginAfterOtp.ok) {
      setStatus('activeLoginAfterPayment', 'PASS')
      note('activeLoginAfterPayment', 'Director login succeeded immediately after payment step.')
      ctx.directorToken = loginAfterOtp.data.token
      ctx.schoolId = loginAfterOtp.data.user.schoolId
      ctx.directorUserId = loginAfterOtp.data.user.id
    } else {
      setStatus('activeLoginAfterPayment', 'PARTIAL')
      note('activeLoginAfterPayment', `Login after payment step failed (${loginAfterOtp.status}): ${toJsonSafe(loginAfterOtp.data)}`)

      const directorRecord = await prisma.user.findFirst({
        where: { email: users.director.email, role: 'DIRECTOR' },
        select: { id: true, schoolId: true },
      })

      if (directorRecord) {
        ctx.directorUserId = directorRecord.id
        ctx.schoolId = directorRecord.schoolId
        await ensureActiveSubscriptionForSchool(directorRecord.schoolId)
        note('activeLoginAfterPayment', 'Temporarily activated school + subscription in DB for downstream QA checks.')
      }
    }

    // Ensure director token exists for CRUD tests.
    if (!ctx.directorToken) {
      const directorLogin = await loginAndStore('DIRECTOR', users.director.email, users.director.password)
      if (!directorLogin.ok) {
        throw new Error(`Unable to login director for CRUD tests: ${toJsonSafe(directorLogin.response.data)}`)
      }
      ctx.schoolId = directorLogin.response.data.user.schoolId
      ctx.directorUserId = directorLogin.response.data.user.id
    }

    if (ctx.schoolId) {
      await ensureActiveSubscriptionForSchool(ctx.schoolId)
    }

    // 4) Refresh persistence (API proxy)
    const meRes = await apiRequest('GET', '/api/auth/me', { token: ctx.directorToken })
    if (meRes.ok && meRes.data?.role === 'DIRECTOR') {
      setStatus('refreshPersistence', 'PASS')
      note('refreshPersistence', '/api/auth/me returns valid director identity with existing token.')
    } else {
      setStatus('refreshPersistence', 'FAIL')
      note('refreshPersistence', `/api/auth/me failed (${meRes.status}): ${toJsonSafe(meRes.data)}`)
    }

    // 5) Director CRUD
    const createPrincipal = await apiRequest('POST', '/api/principals', {
      token: ctx.directorToken,
      body: {
        firstName: 'QA',
        lastName: 'Principal',
        email: users.principal.email,
        password: users.principal.password,
      },
    })

    const principalList = await apiRequest('GET', '/api/principals', { token: ctx.directorToken })

    const createTeacher = await apiRequest('POST', '/api/teachers', {
      token: ctx.directorToken,
      body: {
        firstName: 'QA',
        lastName: 'Teacher',
        email: users.teacher.email,
        password: users.teacher.password,
        designation: 'Form Teacher',
        specialization: 'English',
      },
    })

    const teachersList = await apiRequest('GET', '/api/teachers', { token: ctx.directorToken })
    const teacherRows = normalizeListPayload(teachersList.data, ['teachers', 'data', 'items'])
    const teacherRow = teacherRows.find(t => t.email === users.teacher.email)
    if (teacherRow) {
      ctx.teacherUserId = teacherRow.id
      ctx.teacherStaffId = teacherRow.staffProfile?.id || null
    }

    const createClassRes = await apiRequest('POST', '/api/classes', {
      token: ctx.directorToken,
      body: {
        level: 'JS1',
        arm: 'A',
        classTeacherId: ctx.teacherStaffId,
      },
    })

    const classesList = await apiRequest('GET', '/api/classes', { token: ctx.directorToken })
    const classRows = normalizeListPayload(classesList.data, ['classes', 'data', 'items'])
    const classRow = classRows.find(c => c.level === 'JS1' && c.arm === 'A')
    if (classRow) {
      ctx.classId = classRow.id
    }

    const createStudentRes = await apiRequest('POST', '/api/students', {
      token: ctx.directorToken,
      body: {
        firstName: 'QA',
        lastName: 'Student',
        email: users.student.email,
        password: users.student.password,
        admissionNo: `ADM-${suffix}`,
        gender: 'MALE',
        dateOfBirth: '2012-01-01',
        classId: ctx.classId,
        academicYear: '2024/2025',
      },
    })

    const studentsList = await apiRequest('GET', '/api/students', { token: ctx.directorToken })
    const studentRows = normalizeListPayload(studentsList.data, ['students', 'data', 'items'])
    const studentRow = studentRows.find(s => s.email === users.student.email)
    if (studentRow) {
      ctx.studentUserId = studentRow.id
      ctx.studentProfileId = studentRow.studentProfile?.id || null
    }

    const createSubjectRes = await apiRequest('POST', '/api/subjects', {
      token: ctx.directorToken,
      body: {
        name: 'English',
        code: `ENG-${suffix}`,
        level: 'JS1',
        teacherId: ctx.teacherStaffId,
        classId: ctx.classId,
      },
    })

    const subjectsList = await apiRequest('GET', '/api/subjects', { token: ctx.directorToken })
    const subjectRows = normalizeListPayload(subjectsList.data, ['subjects', 'data', 'items'])
    const subjectRow = subjectRows.find(s => s.name === 'English' && s.code === `ENG-${suffix}`)
    if (subjectRow) {
      ctx.subjectId = subjectRow.id
    }

    const createNoticeRes = await apiRequest('POST', '/api/notices', {
      token: ctx.directorToken,
      body: {
        title: 'QA Notice',
        content: 'QA notice content for teacher.',
        target: 'TEACHER',
      },
    })
    if (createNoticeRes.ok) {
      ctx.noticeId = createNoticeRes.data?.id || null
    }
    const noticesList = await apiRequest('GET', '/api/notices', { token: ctx.directorToken })

    const logoAssetPath = path.resolve(serverDir, '../client/src/assets/hero.png')
    const logoBytes = fs.readFileSync(logoAssetPath)
    const logoBlob = new Blob([logoBytes], { type: 'image/png' })
    const schoolSettingsForm = new FormData()
    schoolSettingsForm.append('name', `QA School ${suffix} Updated`)
    schoolSettingsForm.append('address', 'QA Street, Lagos')
    schoolSettingsForm.append('phone', '08012345678')
    schoolSettingsForm.append('directorFullName', 'QA Director')
    schoolSettingsForm.append('logo', logoBlob, 'qa-logo.png')

    const settingsUpdateRes = await apiRequest('PATCH', '/api/settings/school', {
      token: ctx.directorToken,
      body: schoolSettingsForm,
    })

    let logoFetchOk = false
    if (settingsUpdateRes.ok && settingsUpdateRes.data?.user?.logoUrl) {
      const logoResponse = await fetch(`${apiBase}${settingsUpdateRes.data.user.logoUrl}`)
      logoFetchOk = logoResponse.ok
    }

    const directorCrudOk = [
      createPrincipal.ok,
      principalList.ok,
      createTeacher.ok,
      createClassRes.ok,
      createStudentRes.ok,
      createSubjectRes.ok,
      createNoticeRes.ok,
      noticesList.ok,
      settingsUpdateRes.ok,
      logoFetchOk,
    ].every(Boolean)

    if (directorCrudOk) {
      setStatus('directorCrud', 'PASS')
      note('directorCrud', 'Principal/teacher/class/student/subject/notice CRUD and school logo upload/read all succeeded.')
    } else {
      setStatus('directorCrud', 'PARTIAL')
      note('directorCrud', `One or more director CRUD/settings calls failed. createPrincipal=${createPrincipal.status}, createTeacher=${createTeacher.status}, createClass=${createClassRes.status}, createStudent=${createStudentRes.status}, createSubject=${createSubjectRes.status}, createNotice=${createNoticeRes.status}, settingsUpdate=${settingsUpdateRes.status}, logoFetchOk=${logoFetchOk}`)
    }

    // 6) Principal CRUD
    const principalLogin = await loginAndStore('PRINCIPAL', users.principal.email, users.principal.password)
    if (!principalLogin.ok) {
      setStatus('principalCrud', 'FAIL')
      note('principalCrud', `Principal login failed (${principalLogin.response.status}): ${toJsonSafe(principalLogin.response.data)}`)
    } else {
      ctx.principalUserId = principalLogin.response.data.user.id
      const principalCreateTeacher = await apiRequest('POST', '/api/teachers', {
        token: ctx.principalToken,
        body: {
          firstName: 'QA',
          lastName: 'Teacher2',
          email: `qa.teacher2.${suffix}@example.com`,
          password: 'Password123!',
          designation: 'Subject Teacher',
          specialization: 'Math',
        },
      })
      const principalCreateNotice = await apiRequest('POST', '/api/notices', {
        token: ctx.principalToken,
        body: {
          title: 'Principal Notice',
          content: 'Principal QA notice',
          target: 'STUDENT',
        },
      })
      const principalClasses = await apiRequest('GET', '/api/classes', { token: ctx.principalToken })
      if (principalCreateTeacher.ok && principalCreateNotice.ok && principalClasses.ok) {
        setStatus('principalCrud', 'PASS')
        note('principalCrud', 'Principal create teacher/create notice/read classes succeeded.')
      } else {
        setStatus('principalCrud', 'PARTIAL')
        note('principalCrud', `principalCreateTeacher=${principalCreateTeacher.status}, principalCreateNotice=${principalCreateNotice.status}, principalClasses=${principalClasses.status}`)
      }
    }

    // 7) Teacher results and PDF upload
    const teacherLogin = await loginAndStore('TEACHER', users.teacher.email, users.teacher.password)
    if (!teacherLogin.ok) {
      setStatus('teacherResultsPdfUpload', 'FAIL')
      note('teacherResultsPdfUpload', `Teacher login failed (${teacherLogin.response.status}): ${toJsonSafe(teacherLogin.response.data)}`)
    } else {
      const teacherDashboard = await apiRequest('GET', '/api/teacher/dashboard', { token: ctx.teacherToken })
      const createResultRes = await apiRequest('POST', '/api/results', {
        token: ctx.teacherToken,
        body: {
          studentId: ctx.studentProfileId,
          subjectId: ctx.subjectId,
          classId: ctx.classId,
          academicYear: '2024/2025',
          term: 'First Term',
          firstTest: 18,
          secondTest: 17,
          exam: 60,
        },
      })
      if (createResultRes.ok) {
        ctx.resultId = createResultRes.data?.result?.id || null
      }

      const pdfPath = path.resolve(serverDir, 'test-assets', 'sample-result.pdf')
      const bytes = fs.readFileSync(pdfPath)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const form = new FormData()
      form.append('studentId', String(ctx.studentProfileId || ''))
      form.append('subjectId', String(ctx.subjectId || ''))
      form.append('classId', String(ctx.classId || ''))
      form.append('academicYear', '2024/2025')
      form.append('term', 'First Term')
      form.append('resultPdf', blob, 'sample-result.pdf')

      const uploadPdfRes = await apiRequest('POST', '/api/results/documents/upload', {
        token: ctx.teacherToken,
        body: form,
      })
      if (uploadPdfRes.ok) {
        ctx.resultDocId = uploadPdfRes.data?.document?.id || null
      }

      if (teacherDashboard.ok && createResultRes.ok && uploadPdfRes.ok) {
        setStatus('teacherResultsPdfUpload', 'PASS')
        note('teacherResultsPdfUpload', 'Teacher dashboard, score result save, and PDF upload all succeeded.')
      } else {
        setStatus('teacherResultsPdfUpload', 'PARTIAL')
        note('teacherResultsPdfUpload', `teacherDashboard=${teacherDashboard.status}, createResult=${createResultRes.status}, uploadPdf=${uploadPdfRes.status}`)
      }
    }

    // 8) Student result slip and PDF view/print
    const studentLogin = await loginAndStore('STUDENT', users.student.email, users.student.password)
    if (!studentLogin.ok) {
      setStatus('studentResultSlipPdfViewPrint', 'FAIL')
      note('studentResultSlipPdfViewPrint', `Student login failed (${studentLogin.response.status}): ${toJsonSafe(studentLogin.response.data)}`)
    } else {
      const docsRes = await apiRequest('GET', '/api/results/documents?academicYear=2024/2025&term=First%20Term', {
        token: ctx.studentToken,
      })
      const slipRes = await apiRequest('GET', '/api/results/report-slip?academicYear=2024/2025&term=First%20Term', {
        token: ctx.studentToken,
      })

      let fileViewRes = { status: 0, ok: false }
      let fileDownloadRes = { status: 0, ok: false }
      const studentDocs = normalizeListPayload(docsRes.data, ['documents', 'data', 'items'])
      const docId = studentDocs[0]?.id || ctx.resultDocId
      if (docId) {
        const view = await fetch(`${apiBase}/api/results/documents/${docId}/file`, {
          headers: { Authorization: `Bearer ${ctx.studentToken}` }
        })
        const download = await fetch(`${apiBase}/api/results/documents/${docId}/file?download=1`, {
          headers: { Authorization: `Bearer ${ctx.studentToken}` }
        })
        fileViewRes = { status: view.status, ok: view.ok }
        fileDownloadRes = { status: download.status, ok: download.ok }
      }

      if (docsRes.ok && slipRes.ok && fileViewRes.ok && fileDownloadRes.ok) {
        setStatus('studentResultSlipPdfViewPrint', 'PASS')
        note('studentResultSlipPdfViewPrint', 'Student document list, report slip, view PDF, and download PDF succeeded.')
      } else {
        setStatus('studentResultSlipPdfViewPrint', 'PARTIAL')
        note('studentResultSlipPdfViewPrint', `docs=${docsRes.status}, slip=${slipRes.status}, view=${fileViewRes.status}, download=${fileDownloadRes.status}`)
      }
    }

    // 9) Subscription expiry and renewal
    if (ctx.schoolId) {
      await prisma.subscription.updateMany({
        where: {
          schoolId: ctx.schoolId,
          status: 'ACTIVE',
        },
        data: { status: 'EXPIRED' },
      })
      await prisma.subscription.create({
        data: {
          schoolId: ctx.schoolId,
          planName: 'TERM_SUBSCRIPTION',
          termName: 'First Term',
          amount: 200000,
          startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          status: 'ACTIVE',
          paymentReference: `SUB-EXPIRE-${suffix}`,
        },
      })
      await prisma.school.update({
        where: { id: ctx.schoolId },
        data: { status: 'ACTIVE' },
      })

      const teacherLoginAfterExpiry = await apiRequest('POST', '/api/auth/login', {
        body: { email: users.teacher.email, password: users.teacher.password },
      })
      const directorSubStatus = await apiRequest('GET', '/api/payments/subscription/status', {
        token: ctx.directorToken,
      })
      const renewalInit = await apiRequest('POST', '/api/payments/subscription/initialize', {
        token: ctx.directorToken,
        body: { termName: 'Second Term' },
      })

      if (teacherLoginAfterExpiry.status === 403 && directorSubStatus.ok) {
        if (renewalInit.ok) {
          setStatus('subscriptionExpiryRenewal', 'PASS')
          note('subscriptionExpiryRenewal', 'Expiry blocks non-director login and renewal initialize succeeded.')
        } else {
          setStatus('subscriptionExpiryRenewal', 'PARTIAL')
          note('subscriptionExpiryRenewal', `Expiry enforcement works, renewal initialize returned ${renewalInit.status}: ${toJsonSafe(renewalInit.data)}`)
        }
      } else {
        setStatus('subscriptionExpiryRenewal', 'FAIL')
        note('subscriptionExpiryRenewal', `teacherLoginAfterExpiry=${teacherLoginAfterExpiry.status}, directorSubStatus=${directorSubStatus.status}`)
      }
    } else {
      setStatus('subscriptionExpiryRenewal', 'PARTIAL')
      note('subscriptionExpiryRenewal', 'School ID not available; could not run expiry simulation.')
    }

    // 10) Notices and notifications
    // Ensure the school is in an ACTIVE access state so this check reflects
    // notice/notification behavior rather than subscription-expiry gating.
    if (ctx.schoolId) {
      await prisma.school.update({
        where: { id: ctx.schoolId },
        data: { status: 'ACTIVE' },
      })
      await prisma.subscription.create({
        data: {
          schoolId: ctx.schoolId,
          planName: 'TERM_SUBSCRIPTION',
          termName: 'Third Term',
          amount: 350000,
          startDate: new Date(),
          endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          status: 'ACTIVE',
          paymentReference: `SUB-ACTIVE-${suffix}`,
        },
      })
    }

    const noticesForTeacher = await apiRequest('GET', '/api/notices', { token: ctx.teacherToken })
    const notificationsNoAuth = await apiRequest('GET', '/api/notifications')
    const notificationsAuth = await apiRequest('GET', '/api/notifications', { token: ctx.teacherToken })
    const notificationRows = normalizeListPayload(notificationsAuth.data, ['notifications', 'data', 'items'])
    let markRead = { status: 0, ok: false }
    const firstNotification = notificationRows[0]
    if (firstNotification?.id) {
      markRead = await apiRequest('PATCH', `/api/notifications/${firstNotification.id}/read`, {
        token: ctx.teacherToken,
      })
    }

    if (noticesForTeacher.ok && notificationsAuth.ok && !notificationsNoAuth.ok) {
      if (markRead.ok || notificationRows.length === 0) {
        setStatus('noticesNotifications', 'PASS')
        note('noticesNotifications', 'Teacher notices and notification auth/read flow succeeded.')
      } else {
        setStatus('noticesNotifications', 'PARTIAL')
        note('noticesNotifications', `markRead returned ${markRead.status}`)
      }
    } else {
      setStatus('noticesNotifications', 'PARTIAL')
      note('noticesNotifications', `noticesForTeacher=${noticesForTeacher.status}, notificationsNoAuth=${notificationsNoAuth.status}, notificationsAuth=${notificationsAuth.status}`)
    }

    // cleanup delete paths tested via director
    if (ctx.noticeId) {
      await apiRequest('DELETE', `/api/notices/${ctx.noticeId}`, { token: ctx.directorToken })
    }
  } catch (error) {
    note('otpRegistration', `Fatal test runner error: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    try {
      await prisma.$disconnect()
    } catch {
      // ignore
    }
    server.kill('SIGTERM')
    await delay(800)

    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      users,
      context: {
        schoolId: ctx.schoolId,
        paymentReference: ctx.paymentReference,
        classId: ctx.classId,
        subjectId: ctx.subjectId,
        studentProfileId: ctx.studentProfileId,
        resultId: ctx.resultId,
        resultDocId: ctx.resultDocId,
      },
      report,
      serverLogTail: {
        stdout: stdout.slice(-1500),
        stderr: stderr.slice(-1500),
      }
    }, null, 2))
  }
}

run()
