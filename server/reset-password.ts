import prisma from './src/db/prisma.js'
import bcrypt from 'bcrypt'

async function resetPassword() {
  const hashedPassword = await bcrypt.hash('Password123!', 10)
  await prisma.user.update({
    where: { email: 'zeeben@gmail.com' },
    data: { password: hashedPassword }
  })
  console.log('Password reset to Password123! for zeeben@gmail.com')
}

resetPassword()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
