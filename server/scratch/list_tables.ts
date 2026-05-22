import prisma from '../src/db/prisma.js'

async function main(){
  try{
    const tables = await prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    console.log('tables:', tables)
  }catch(e){
    console.error('error', e)
  }finally{
    await prisma.$disconnect()
  }
}

main()
