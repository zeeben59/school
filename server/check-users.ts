import prisma from './src/db/prisma.js'

async function checkUsers() {
  const users = await prisma.user.findMany({
    select: { email: true, role: true }
  })
  console.log(JSON.stringify(users, null, 2))
}

checkUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
