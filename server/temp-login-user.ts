import 'dotenv/config'
import prisma from './src/db/prisma.ts'

prisma.user.findMany({
  where: { email: 'admin59@nexus.com' }
})
  .then(users => {
    console.log(JSON.stringify(users, null, 2))
    process.exit(0)
  })
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
