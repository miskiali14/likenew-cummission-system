import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database started...');

  const hashedPassword = await bcrypt.hash('123456', 10);

  // 1. Abuur Users (Admin, Sales, QC) — shared branch logins
  const users = [
    {
      fullName: 'Admin User',
      email: 'admin@likenew.com',
      password: hashedPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    {
      fullName: 'Sales HQ',
      email: 'sales.hq@likenew.com',
      password: hashedPassword,
      role: 'SALES',
      branch: 'HQ',
      status: 'ACTIVE',
    },
    {
      fullName: 'Sales KM5',
      email: 'sales.km5@likenew.com',
      password: hashedPassword,
      role: 'SALES',
      branch: 'KM5',
      status: 'ACTIVE',
    },
    {
      fullName: 'QC HQ',
      email: 'qc.hq@likenew.com',
      password: hashedPassword,
      role: 'QUALITY_CONTROL',
      branch: 'HQ',
      status: 'ACTIVE',
    },
    {
      fullName: 'QC KM5',
      email: 'qc.km5@likenew.com',
      password: hashedPassword,
      role: 'QUALITY_CONTROL',
      branch: 'KM5',
      status: 'ACTIVE',
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: u,
    });
  }

  // 2. Abuur Shaqaalaha Dhaqidda & Feerinta (Employees — commission per piece)
  const employees = [
    { name: 'Qasim', branch: 'HQ', department: 'WASHING', rate: 0.5 },
    { name: 'Hasan Yare', branch: 'HQ', department: 'WASHING', rate: 0.5 },
    { name: 'Hasan Nur', branch: 'HQ', department: 'WASHING', rate: 0.5 },
    { name: 'Abdirahman', branch: 'KM5', department: 'WASHING', rate: 0.5 },
    { name: 'Sakariye', branch: 'KM5', department: 'WASHING', rate: 0.5 },
    { name: 'Omar', branch: 'HQ', department: 'IRONING', rate: 0.75 },
    { name: 'Bishaar', branch: 'HQ', department: 'IRONING', rate: 0.75 },
    { name: 'Abduqadir', branch: 'HQ', department: 'IRONING', rate: 0.75 },
    { name: 'Abdirahman', branch: 'KM5', department: 'IRONING', rate: 0.75 },
    { name: 'Cashara', branch: 'KM5', department: 'IRONING', rate: 0.75 },
    { name: 'Mohamed Gab', branch: 'KM5', department: 'IRONING', rate: 0.75 },
    { name: 'Abdinasir', branch: 'KM5', department: 'IRONING', rate: 0.75 },
  ];

  for (const emp of employees) {
    await prisma.employee.create({ data: emp });
  }

  // 3. Abuur Registrars (Dadka diiwaangelinaya — "Assigned By")
  const registrars = [
    { name: 'Ahmed Abukar', branch: 'HQ', role: 'SALES' },
    { name: 'Ahmed ACM', branch: 'HQ', role: 'SALES' },
    { name: 'Yusuf', branch: 'KM5', role: 'SALES' },
    { name: 'Abdiqani', branch: 'KM5', role: 'SALES' },
    { name: 'Faiso', branch: 'HQ', role: 'QUALITY_CONTROL' },
    { name: 'Dadir', branch: 'HQ', role: 'QUALITY_CONTROL' },
    { name: 'Abdifitah', branch: 'KM5', role: 'QUALITY_CONTROL' },
    { name: 'Abdiqani', branch: 'KM5', role: 'QUALITY_CONTROL' },
  ];

  for (const reg of registrars) {
    await prisma.registrar.create({ data: reg });
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
