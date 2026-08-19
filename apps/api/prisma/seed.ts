import { IntegrationStatus, IntegrationType, Priority, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function upsertInstitution(
  name: string,
  slug: string,
  type: string,
  contact?: string,
  integration?: { integrationType: IntegrationType; integrationStatus: IntegrationStatus },
) {
  return prisma.institution.upsert({
    where: { slug },
    update: {
      name,
      type,
      contact,
      active: true,
      ...(integration ?? {}),
    },
    create: {
      name,
      slug,
      type,
      contact,
      active: true,
      integrationType: integration?.integrationType ?? IntegrationType.MANUAL,
      integrationStatus: integration?.integrationStatus ?? IntegrationStatus.NOT_CONFIGURED,
    },
  });
}

async function main() {
  const komuna = await upsertInstitution(
    'Komuna e Prizrenit',
    'komuna-prizren',
    'MUNICIPALITY',
    'info@prizren-komuna.org',
  );
  // External utility/emergency organizations don't have official API access yet — per
  // the Master Spec's "email fallback" rule (integrate via EMAIL until credentials for
  // a real adapter exist), not MOCK/ACTIVE. Wiring the actual send path is Phase 7/8.
  const externalOrgIntegration = {
    integrationType: IntegrationType.EMAIL,
    integrationStatus: IntegrationStatus.NOT_CONFIGURED,
  };
  const eco = await upsertInstitution(
    'Eco Regjioni',
    'eco-regjioni',
    'UTILITY',
    'info@ecoregjioni.com',
    externalOrgIntegration,
  );
  const keds = await upsertInstitution(
    'KEDS',
    'keds',
    'UTILITY',
    'info@keds-energy.com',
    externalOrgIntegration,
  );
  const kru = await upsertInstitution(
    'KRU Prizreni',
    'kru-prizreni',
    'UTILITY',
    'info@kruprizreni.com',
    externalOrgIntegration,
  );
  const fire = await upsertInstitution(
    'Shërbimi i Zjarrfikësve',
    'fire-rescue',
    'EMERGENCY',
    'emergency@rks-gov.net',
    externalOrgIntegration,
  );
  const police = await upsertInstitution(
    'Policia e Kosovës',
    'kosovo-police',
    'EMERGENCY',
    'info@kosovopolice.com',
    externalOrgIntegration,
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

  // --- Official municipal department registry (Master Spec §3) --------------
  // Organizational/administrative departments, distinct from the operational
  // units above (which already route citizen reports today). Seeded without
  // categories for now — RoutingRule below shows how they can still be
  // targeted directly via free-text `subcategory` matching.
  const officialDepartmentNames = [
    'Administrata',
    'Ekonomia dhe Financat',
    'Shërbimet Publike',
    'Urbanistika dhe Planifikimi Hapësinor',
    'Inspektoratet',
    'Bujqësia dhe Zhvillimi Rural',
    'Gjeodezia dhe Kadastra',
    'Kultura, Rinia dhe Sporti',
    'Arsimi dhe Shkenca',
    'Emergjencat dhe Siguria',
    'Turizmi dhe Zhvillimi Ekonomik',
    'Shëndetësia',
    'Puna dhe Mirëqenia Sociale',
    'Prona dhe Çështjet Ligjore',
    'Zyra e Kryetarit',
    'Kuvendi Komunal',
    'Marrëdhëniet me Publikun',
    'Qendra për Shërbime me Qytetarë',
    'Zyra për Komunitete',
  ];

  const officialDeptByName = new Map<string, { id: string; name: string }>();
  for (const name of officialDepartmentNames) {
    const existing = await prisma.department.findFirst({ where: { name } });
    if (existing) {
      officialDeptByName.set(name, existing);
      continue;
    }
    const created = await prisma.department.create({
      data: { name, institutionId: komuna.id, slaHours: 48 },
    });
    officialDeptByName.set(name, created);
  }

  // --- RoutingRule -----------------------------------------------------------
  // Evaluated by RoutingService (category → institution → department).
  // Example *configuration*, not engine logic. Names like Eco Regjioni / KEDS
  // never appear in RoutingService. Operators can change targets in /admin/routing
  // without a deploy.
  const findCategoryByName = (name: string) => prisma.category.findFirst({ where: { name } });
  const fireCategory = await findCategoryByName('Zjarr / emergjencë');
  const electricityCategory = await findCategoryByName('Elektricitet');
  const waterCategory = await findCategoryByName('Ujë / kanalizim');
  const wasteCategory = await findCategoryByName('Mbeturina');
  const roadCategory = await findCategoryByName('Dëmtim rruge');
  const lightingCategory = await findCategoryByName('Ndriçim');
  const publicSpaceCategory = await findCategoryByName('Hapësirë publike');
  const policeCategory = await findCategoryByName('Siguri / polici');
  const otherCategory = await findCategoryByName('Tjetër');

  const zjarrfikesiaDept = createdDepts.find((d) => d.name === 'Zjarrfikësia');
  const rrjetiElektrikDept = createdDepts.find((d) => d.name === 'Rrjeti elektrik');
  const ujesjellesiDept = createdDepts.find((d) => d.name === 'Ujësjellësi');
  const wasteDept = createdDepts.find((d) => d.name === 'Mjedisi & Mbeturinat');
  const roadDept = createdDepts.find((d) => d.name === 'Rruga & Infrastrukturë');
  const lightingDept = createdDepts.find((d) => d.name === 'Ndriçimi Publik');
  const publicSpaceDept = createdDepts.find((d) => d.name === 'Hapësira Publike');
  const policeDept = createdDepts.find((d) => d.name === 'Siguria publike');
  const inspektoratetDept = officialDeptByName.get('Inspektoratet');
  const punaSocialeDept = officialDeptByName.get('Puna dhe Mirëqenia Sociale');

  const routingRules: {
    name: string;
    categoryId?: string | null;
    subcategory?: string | null;
    severity?: Priority | null;
    isEmergency?: boolean | null;
    departmentId?: string | null;
    institutionId?: string | null;
    priority: number;
    slaHours?: number | null;
    defaultPriority?: Priority | null;
  }[] = [
    {
      name: 'Emergjencë zjarri → Zjarrfikësia',
      categoryId: fireCategory?.id ?? null,
      isEmergency: true,
      departmentId: zjarrfikesiaDept?.id ?? null,
      institutionId: fire.id,
      priority: 10,
      slaHours: 4,
      defaultPriority: Priority.CRITICAL,
    },
    {
      name: 'Ndërtim i paligjshëm → Inspektoratet',
      subcategory: 'illegal_construction',
      departmentId: inspektoratetDept?.id ?? null,
      priority: 20,
    },
    {
      name: 'Ndërprerje rrymë → KEDS',
      categoryId: electricityCategory?.id ?? null,
      departmentId: rrjetiElektrikDept?.id ?? null,
      institutionId: keds.id,
      priority: 30,
      slaHours: 24,
      defaultPriority: Priority.HIGH,
    },
    {
      name: 'Ujë / kanalizim → KRU Prizreni',
      categoryId: waterCategory?.id ?? null,
      departmentId: ujesjellesiDept?.id ?? null,
      institutionId: kru.id,
      priority: 30,
      slaHours: 24,
      defaultPriority: Priority.HIGH,
    },
    {
      name: 'Mbeturina → Eco Regjioni',
      categoryId: wasteCategory?.id ?? null,
      departmentId: wasteDept?.id ?? null,
      institutionId: eco.id,
      priority: 40,
      slaHours: 48,
      defaultPriority: Priority.MEDIUM,
    },
    {
      name: 'Dëmtim rruge → Komuna e Prizrenit',
      categoryId: roadCategory?.id ?? null,
      departmentId: roadDept?.id ?? null,
      institutionId: komuna.id,
      priority: 40,
      slaHours: 72,
      defaultPriority: Priority.MEDIUM,
    },
    {
      name: 'Ndriçim publik → operatori komunal',
      categoryId: lightingCategory?.id ?? null,
      departmentId: lightingDept?.id ?? null,
      institutionId: komuna.id,
      priority: 40,
      slaHours: 48,
      defaultPriority: Priority.MEDIUM,
    },
    {
      name: 'Hapësirë publike → Komuna e Prizrenit',
      categoryId: publicSpaceCategory?.id ?? null,
      departmentId: publicSpaceDept?.id ?? null,
      institutionId: komuna.id,
      priority: 50,
      slaHours: 72,
      defaultPriority: Priority.LOW,
    },
    {
      name: 'Siguri / polici → Policia e Kosovës',
      categoryId: policeCategory?.id ?? null,
      departmentId: policeDept?.id ?? null,
      institutionId: police.id,
      priority: 20,
      slaHours: 8,
      defaultPriority: Priority.HIGH,
    },
    {
      name: 'Tjetër → fallback komunal',
      categoryId: otherCategory?.id ?? null,
      departmentId: publicSpaceDept?.id ?? null,
      institutionId: komuna.id,
      priority: 90,
      slaHours: 72,
      defaultPriority: Priority.LOW,
    },
    {
      name: 'Ndihmë sociale → Puna dhe Mirëqenia Sociale',
      subcategory: 'social_assistance',
      departmentId: punaSocialeDept?.id ?? null,
      priority: 50,
    },
  ];

  for (const rule of routingRules) {
    const existing = await prisma.routingRule.findFirst({ where: { name: rule.name } });
    if (existing) {
      await prisma.routingRule.update({ where: { id: existing.id }, data: rule });
    } else {
      await prisma.routingRule.create({ data: rule });
    }
  }

  // --- SlaPolicy (Master Spec §9) ---------------------------------------------
  // Domain model + seed data only for Phase 1. `computeDueAt()` in
  // reports/sla.ts remains the source of truth until Phase 5 wires SLA
  // computation to consult these policies.
  const slaPolicies: {
    name: string;
    priority: Priority;
    responseTime: number;
    resolutionTime: number;
    departmentId?: string | null;
    categoryId?: string | null;
  }[] = [
    {
      name: 'SLA globale — Kritike',
      priority: Priority.CRITICAL,
      responseTime: 15,
      resolutionTime: 240,
    },
    {
      name: 'SLA globale — E lartë',
      priority: Priority.HIGH,
      responseTime: 60,
      resolutionTime: 1440,
    },
    {
      name: 'SLA globale — Mesatare',
      priority: Priority.MEDIUM,
      responseTime: 240,
      resolutionTime: 4320,
    },
    {
      name: 'SLA globale — E ulët',
      priority: Priority.LOW,
      responseTime: 1440,
      resolutionTime: 10080,
    },
    {
      name: 'SLA — Zjarrfikësia (emergjencë kritike)',
      priority: Priority.CRITICAL,
      responseTime: 10,
      resolutionTime: 60,
      departmentId: zjarrfikesiaDept?.id ?? null,
    },
  ];

  for (const policy of slaPolicies) {
    const existing = await prisma.slaPolicy.findFirst({ where: { name: policy.name } });
    if (existing) {
      await prisma.slaPolicy.update({ where: { id: existing.id }, data: policy });
    } else {
      await prisma.slaPolicy.create({ data: policy });
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
