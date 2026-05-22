import prisma from '../src/db/prisma.js'

async function main(){
  try{
    const admins = await prisma.user.findMany({ where: { role: 'SUPERADMIN' }, select: { id: true, email: true, firstName: true, lastName: true, status: true, mustChangePassword: true } })
    console.log('superadmins:', admins)
    const envEmail = process.env.SUPERADMIN_EMAIL
    if(envEmail){
      const byEmail = await prisma.user.findUnique({ where: { email: String(envEmail) }, select: { id: true, email: true, role: true, status: true } })
      console.log('user for SUPERADMIN_EMAIL:', byEmail)
    }
  }catch(e){
    console.error('error', e)
  }finally{
    await prisma.$disconnect()
  }
}

main()
