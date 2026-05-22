import prisma from '../src/db/prisma.js';
import bcrypt from 'bcrypt';
import { createNumericOtp, hashOtp, getRegistrationOtpExpiry } from '../src/utils/otp.js';
import { z } from 'zod';

const registerSchema = z.object({
  schoolName: z.string().min(3),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  directorFullName: z.string().min(3),
  phone: z.string().min(10),
  address: z.string().min(5)
});

async function reproduce() {
  const body = {
    schoolName: "Royal Academy",
    email: "test-" + Date.now() + "@example.com",
    password: "password123",
    directorFullName: "john doe",
    phone: "+2347039975646",
    address: "No:14 nwafia street"
  };

  try {
    console.log('1. Parsing body...');
    const parsed = registerSchema.parse(body);
    
    console.log('2. checking existing user...');
    const existingUser = await prisma.user.findFirst({ where: { email: parsed.email } });
    console.log('Existing User:', existingUser);

    console.log('3. Hashing password...');
    const passwordHash = await bcrypt.hash(parsed.password, 10);
    
    console.log('4. Generating OTP...');
    const otpCode = createNumericOtp(6);
    const otpHash = hashOtp(otpCode);
    const otpExpiresAt = getRegistrationOtpExpiry();

    console.log('5. Upserting pending registration...');
    // Manual execution of upsert logic
    const existingPending = await (prisma as any).pendingRegistration.findUnique({
      where: { email: parsed.email }
    });
    
    if (existingPending) {
       console.log('Updating existing pending...');
       await (prisma as any).pendingRegistration.update({
         where: { email: parsed.email },
         data: { schoolName: parsed.schoolName, directorFirstName: "Test", directorLastName: "User", passwordHash, phone: parsed.phone, address: parsed.address, otpHash, otpExpiresAt, status: 'PENDING_OTP' }
       });
    } else {
       console.log('Creating new pending...');
       await (prisma as any).pendingRegistration.create({
         data: { email: parsed.email, schoolName: parsed.schoolName, directorFirstName: "Test", directorLastName: "User", passwordHash, phone: parsed.phone, address: parsed.address, otpHash, otpExpiresAt, status: 'PENDING_OTP' }
       });
    }
    
    console.log('SUCCESS: Step-by-step reproduction completed.');
  } catch (error: any) {
    console.error('CRASHED AT STEP:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

reproduce();

