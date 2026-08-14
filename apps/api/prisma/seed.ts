import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function upsertInstitution(name: string, slug: string, type: string, contact?: string) {
  return prisma.institution.upsert({
    where: { slug },
    update: { name, type, contact, active: true },
    create: { name, slug, type, contact, active: true },
  });
}

async function main() {
  const komuna = await upsertInstitution(
    'Komuna e Prizrenit',
    'komuna-prizren',
    'MUNICIPALITY',
    'info@prizren-komuna.org',
  );
  const eco = await upsertInstitution(
    'Eco Regjioni',
    'eco-regjioni',
    'UTILITY',
    'info@ecoregjioni.com',
  );
  const keds = await upsertInstitution('KEDS', 'keds', 'UTILITY', 'info@keds-energy.com');
  const kru = await upsertInstitution(
    'KRU Prizreni',
    'kru-prizreni',
    'UTILITY',
    'info@kruprizreni.com',
  );
  const fire = await upsertInstitution(
    'Shërbimi i Zjarrfikësve',
    'fire-rescue',
    'EMERGENCY',
    'emergency@rks-gov.net',
  );
  const police = await upsertInstitution(
    'Policia e Kosovës',
    'kosovo-police',
    'EMERGENCY',
    'info@kosovopolice.com',
  );

  const departments = [
    {
      name: 'Rruga & Infrastrukturë',
      contact: 'rruga@prizren.city',
      institutionId: komuna.id,
      slaHours: 72,
    },
    {
      name: 'Ndriçimi Publik',
      contact: 'ndricimi@prizren.city',
      institutionId: komuna.id,
      slaHours: 48,
    },
    {
      name: 'Mjedisi & Mbeturinat',
      contact: 'mjedisi@prizren.city',
      institutionId: eco.id,
      slaHours: 48,
    },
    { name: 'Ujësjellësi', contact: 'uji@prizren.city', institutionId: kru.id, slaHours: 24 },
    {
      name: 'Hapësira Publike',
      contact: 'hapësira@prizren.city',
      institutionId: komuna.id,
      slaHours: 72,
    },
    {
      name: 'Rrjeti elektrik',
      contact: 'info@keds-energy.com',
      institutionId: keds.id,
      slaHours: 24,
    },
    {
      name: 'Zjarrfikësia',
      contact: 'emergency@rks-gov.net',
      institutionId: fire.id,
      slaHours: 4,
    },
    {
      name: 'Siguria publike',
      contact: 'info@kosovopolice.com',
      institutionId: police.id,
      slaHours: 8,
    },
  ];

  const createdDepts: { id: string; name: string }[] = [];
  for (const dept of departments) {
    const existing = await prisma.department.findFirst({ where: { name: dept.name } });
    if (existing) {
      await prisma.department.update({
        where: { id: existing.id },
        data: {
          contact: dept.contact,
          institutionId: dept.institutionId,
          slaHours: dept.slaHours,
        },
      });
      createdDepts.push(existing);
      continue;
    }
    createdDepts.push(await prisma.department.create({ data: dept }));
  }

  const categories = [
    {
      name: 'Dëmtim rruge',
      departmentName: 'Rruga & Infrastrukturë',
      slaHours: 72,
      defaultPriority: 'MEDIUM' as const,
    },
    {
      name: 'Ndriçim',
      departmentName: 'Ndriçimi Publik',
      slaHours: 48,
      defaultPriority: 'MEDIUM' as const,
    },
    {
      name: 'Mbeturina',
      departmentName: 'Mjedisi & Mbeturinat',
      slaHours: 48,
      defaultPriority: 'MEDIUM' as const,
    },
    {
      name: 'Ujë / kanalizim',
      departmentName: 'Ujësjellësi',
      slaHours: 24,
      defaultPriority: 'HIGH' as const,
    },
    {
      name: 'Hapësirë publike',
      departmentName: 'Hapësira Publike',
      slaHours: 72,
      defaultPriority: 'LOW' as const,
    },
    {
      name: 'Elektricitet',
      departmentName: 'Rrjeti elektrik',
      slaHours: 24,
      defaultPriority: 'HIGH' as const,
    },
    {
      name: 'Zjarr / emergjencë',
      departmentName: 'Zjarrfikësia',
      slaHours: 4,
      defaultPriority: 'CRITICAL' as const,
    },
    {
      name: 'Siguri / polici',
      departmentName: 'Siguria publike',
      slaHours: 8,
      defaultPriority: 'HIGH' as const,
    },
    {
      name: 'Tjetër',
      departmentName: 'Hapësira Publike',
      slaHours: 72,
      defaultPriority: 'LOW' as const,
    },
  ];

  for (const cat of categories) {
    const dept = createdDepts.find((d) => d.name === cat.departmentName);
    if (!dept) continue;
    const existing = await prisma.category.findFirst({
      where: { name: cat.name, departmentId: dept.id },
    });
    if (!existing) {
      await prisma.category.create({
        data: {
          name: cat.name,
          departmentId: dept.id,
          slaHours: cat.slaHours,
          defaultPriority: cat.defaultPriority,
        },
      });
    } else {
      await prisma.category.update({
        where: { id: existing.id },
        data: { slaHours: cat.slaHours, defaultPriority: cat.defaultPriority },
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
