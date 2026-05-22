import Fastify from 'fastify'

async function check() {
  const res = await fetch('http://localhost:5000/api/students/randomid123', {
    method: 'DELETE',
    headers: { Authorization: `Bearer fake-token`, 'Origin': 'http://localhost:5173' }
  })
  console.log('Status:', res.status)
  const body = await res.text()
  console.log('Body:', body)
}

check()
