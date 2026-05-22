import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTable() {
  try {
    const tableInfo = await prisma.$queryRawUnsafe("PRAGMA table_info(PendingRegistration)");
    console.log('Table Info:', JSON.stringify(tableInfo, null, 2));
    
    const count = await (prisma as any).pendingRegistration.count();
    console.log('Current Count:', count);
  } catch (error: any) {
    console.error('Database Check Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTable();
