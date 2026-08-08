import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const departments = [
    { name: 'Rruga & Infrastrukturë', contact: 'rruga@prizren.city' },
    { name: 'Ndriçimi Publik', contact: 'ndricimi@prizren.city' },
    { name: 'Mjedisi & Mbeturinat', contact: 'mjedisi@prizren.city' },
    { name: 'Ujësjellësi', contact: 'uji@prizren.city' },
    { name: 'Hapësira Publike', contact: 'hapësira@prizren.city' },
  ];

  const createdDepts: { id: string; name: string }[] = [];
  for (const dept of departments) {
    const existing = await prisma.department.findFirst({ where: { name: dept.name } });
    if (existing) {
      createdDepts.push(existing);
      continue;
    }
    createdDepts.push(await prisma.department.create({ data: dept }));
  }

  const categories = [
    { name: 'Dëmtim rruge', departmentName: 'Rruga & Infrastrukturë' },
    { name: 'Ndriçim', departmentName: 'Ndriçimi Publik' },
    { name: 'Mbeturina', departmentName: 'Mjedisi & Mbeturinat' },
    { name: 'Ujë / kanalizim', departmentName: 'Ujësjellësi' },
    { name: 'Hapësirë publike', departmentName: 'Hapësira Publike' },
    { name: 'Tjetër', departmentName: 'Hapësira Publike' },
  ];

  for (const cat of categories) {
    const dept = createdDepts.find((d) => d.name === cat.departmentName);
    if (!dept) continue;
    const existing = await prisma.category.findFirst({
      where: { name: cat.name, departmentId: dept.id },
    });
    if (!existing) {
      await prisma.category.create({
        data: { name: cat.name, departmentId: dept.id },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
