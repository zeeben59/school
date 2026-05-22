import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTable() {
  try {
    const tableInfo = await prisma.$queryRaw`PRAGMA table_info(PendingRegistration)`;
    console.log('Table Info Length:', Array.isArray(tableInfo) ? tableInfo.length : 'not an array');
    
    // Check if the table is actually queryable via the model
    const count = await (prisma as any).pendingRegistration.count();
    console.log('Current PendingRegistration Count:', count);
    
    const schools = await prisma.school.count();
    console.log('Current School Count:', schools);

    console.log('Database check completed successfully.');
  } catch (error: any) {
    console.error('DATABASE DIAGNOSTIC ERROR:', error.message);
    if (error.stack) console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkTable();
