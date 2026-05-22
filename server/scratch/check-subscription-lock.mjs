import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const apiBase = 'http://localhost:5000'
const suffix = Date.now().toString().slice(-6)
const email = `lock.check.${suffix}@example.com`
const password = 'Password123!'

async function apiRequest(method, path, body, token) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
  return { status: res.status, ok: res.ok, data }
}

async function waitHealth() {
  for (let i = 0; i < 25; i++) {
    try {
      const res = await apiRequest('GET', '/api/health')
      if (res.ok) return true
    } catch {}
    await delay(700)
  }
  return false
}

async function run() {
  const server = spawn('node', ['dist/index.js'], { stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    if (!(await waitHealth())) {
      throw new Error('Server not healthy')
    }

    const register = await apiRequest('POST', '/api/auth/register', {
      schoolName: `Lock School ${suffix}`,
      email,
      password,
      directorFullName: 'Lock Director',
      phone: '08012345678',
      address: 'Lock Address'
    })

    const otp = register.data?.debug?.otpCode
    const verify = await apiRequest('POST', '/api/auth/verify-registration-otp', { email, otpCode: otp })
    const login = await apiRequest('POST', '/api/auth/login', { email, password })
    const token = login.data?.token
    const createTeacher = await apiRequest('POST', '/api/teachers', {
      firstName: 'No',
      lastName: 'Access',
      email: `blocked.teacher.${suffix}@example.com`,
      password: 'Password123!'
    }, token)

    console.log(JSON.stringify({
      registerStatus: register.status,
      verifyStatus: verify.status,
      loginStatus: login.status,
      createTeacherStatus: createTeacher.status,
      createTeacherError: createTeacher.data?.error,
      createTeacherCode: createTeacher.data?.code
    }, null, 2))
  } finally {
    server.kill('SIGTERM')
  }
}

run()
