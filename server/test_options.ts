import Fastify from 'fastify'

async function checkOptions() {
  const res = await fetch('http://localhost:5000/api/students/1234', {
    method: 'OPTIONS',
    headers: { 'Origin': 'http://localhost:5173', 'Access-Control-Request-Method': 'DELETE' }
  })
  console.log('OPTIONS Status:', res.status)
  console.log('OPTIONS Headers:', res.headers.get('access-control-allow-origin'))
  const body = await res.text()
  console.log('OPTIONS Body:', body)
}

checkOptions()
