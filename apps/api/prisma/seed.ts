import { IntegrationStatus, IntegrationType, Priority, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Public switchboard only — never stored in `contact` (that field is treated as email). */
const KOMUNA_PUBLIC_TEL = '0800 11 002';
const KOMUNA_ADDRESS = 'Remzi Ademaj p.n., Prizren 20000';

const DEPARTMENT_ALIASES: Record<string, string[]> = {
  Administratë: ['Administrata'],
  'Ekonomi dhe Financave': ['Ekonomia dhe Financat'],
  'Shërbime Publike': ['Shërbimet Publike'],
  'Urbanizëm dhe Planifikim Hapësinor': ['Urbanistika dhe Planifikimi Hapësinor'],
  Inspektorate: ['Inspektoratet'],
  'Bujqësi dhe Zhvillim Rural': ['Bujqësia dhe Zhvillimi Rural'],
  'Gjeodezi dhe Kadastër': ['Gjeodezia dhe Kadastra'],
  'Kulturë, Rini dhe Sport': ['Kultura, Rinia dhe Sporti'],
  'Arsim dhe Shkencë': ['Arsimi dhe Shkenca'],
  'Emergjencë dhe Siguri': ['Emergjencat dhe Siguria'],
  'Turizëm dhe Zhvillim Ekonomik': ['Turizmi dhe Zhvillimi Ekonomik'],
  Shëndetësi: ['Shëndetësia'],
  'Punë dhe Mirëqenie Sociale': ['Puna dhe Mirëqenia Sociale'],
  'Pronë dhe Çështje Ligjore': ['Prona dhe Çështjet Ligjore'],
};

const CATEGORY_ALIASES: Record<string, string[]> = {
  'Grope / dëmtim rruge': ['Dëmtim rruge'],
  'Ndriçim publik i prishur': ['Ndriçim'],
  'Grumbullim mbeturinash / konteiner': ['Mbeturina'],
  'Ujë i pijshëm (ndërprerje / cilësi)': ['Ujë / kanalizim'],
  'Parke, pemë, hapësirë e gjelbër': ['Hapësirë publike'],
  'Tjetër / e paklasifikuar': ['Tjetër'],
  'Rrezik zjarri / emergjencë': ['Zjarr / emergjencë'],
};

const DEPARTMENTS: { name: string; slaHours: number }[] = [
  { name: 'Administratë', slaHours: 168 },
  { name: 'Ekonomi dhe Financave', slaHours: 168 },
  { name: 'Shërbime Publike', slaHours: 48 },
  { name: 'Urbanizëm dhe Planifikim Hapësinor', slaHours: 72 },
  { name: 'Inspektorate', slaHours: 48 },
  { name: 'Bujqësi dhe Zhvillim Rural', slaHours: 240 },
  { name: 'Gjeodezi dhe Kadastër', slaHours: 168 },
  { name: 'Kulturë, Rini dhe Sport', slaHours: 120 },
  { name: 'Arsim dhe Shkencë', slaHours: 48 },
  { name: 'Emergjencë dhe Siguri', slaHours: 24 },
  { name: 'Turizëm dhe Zhvillim Ekonomik', slaHours: 168 },
  { name: 'Shëndetësi', slaHours: 48 },
  { name: 'Punë dhe Mirëqenie Sociale', slaHours: 168 },
  { name: 'Pronë dhe Çështje Ligjore', slaHours: 240 },
];

const CATEGORIES: {
  name: string;
  departmentName: string;
  slaHours: number;
  defaultPriority: Priority;
}[] = [
  {
    name: 'Grope / dëmtim rruge',
    departmentName: 'Shërbime Publike',
    slaHours: 120,
    defaultPriority: Priority.MEDIUM,
  },
  {
    name: 'Ndriçim publik i prishur',
    departmentName: 'Shërbime Publike',
    slaHours: 48,
    defaultPriority: Priority.HIGH,
  },
  {
    name: 'Grumbullim mbeturinash / konteiner',
    departmentName: 'Shërbime Publike',
    slaHours: 72,
    defaultPriority: Priority.MEDIUM,
  },
  {
    name: 'Kanalizim / përmbytje urbane',
    departmentName: 'Shërbime Publike',
    slaHours: 48,
    defaultPriority: Priority.HIGH,
  },
  {
    name: 'Ujë i pijshëm (ndërprerje / cilësi)',
    departmentName: 'Shërbime Publike',
    slaHours: 24,
    defaultPriority: Priority.HIGH,
  },
  {
    name: 'Parke, pemë, hapësirë e gjelbër',
    departmentName: 'Shërbime Publike',
    slaHours: 168,
    defaultPriority: Priority.LOW,
  },
  {
    name: 'Ndërtim pa leje / shkelje urbanistike',
    departmentName: 'Urbanizëm dhe Planifikim Hapësinor',
    slaHours: 72,
    defaultPriority: Priority.HIGH,
  },
  {
    name: 'Pengesë në trotuar / qasje',
    departmentName: 'Urbanizëm dhe Planifikim Hapësinor',
    slaHours: 120,
    defaultPriority: Priority.MEDIUM,
  },
  {
    name: 'Hedhje e paligjshme / ndotje',
    departmentName: 'Inspektorate',
    slaHours: 48,
    defaultPriority: Priority.HIGH,
  },
  {
    name: 'Zhurmë / shqetësim në lagje',
    departmentName: 'Inspektorate',
    slaHours: 72,
    defaultPriority: Priority.MEDIUM,
  },
  {
    name: 'Rrezik zjarri / emergjencë',
    departmentName: 'Emergjencë dhe Siguri',
    slaHours: 24,
    defaultPriority: Priority.CRITICAL,
  },
  {
    name: 'Sinjalistikë / rrezik në trafik',
    departmentName: 'Emergjencë dhe Siguri',
    slaHours: 48,
    defaultPriority: Priority.HIGH,
  },
  {
    name: 'Monument / trashëgimi e dëmtuar',
    departmentName: 'Kulturë, Rini dhe Sport',
    slaHours: 120,
    defaultPriority: Priority.MEDIUM,
  },
  {
    name: 'Infrastrukturë shkollore e rrezikshme',
    departmentName: 'Arsim dhe Shkencë',
    slaHours: 48,
    defaultPriority: Priority.HIGH,
  },
  {
    name: 'Infrastrukturë e kujdesit shëndetësor komunal',
    departmentName: 'Shëndetësi',
    slaHours: 48,
    defaultPriority: Priority.HIGH,
  },
  {
    name: 'Tjetër / e paklasifikuar',
    departmentName: 'Administratë',
    slaHours: 168,
    defaultPriority: Priority.LOW,
  },
  {
    name: 'Kafshë endacake',
    departmentName: 'Bujqësi dhe Zhvillim Rural',
    slaHours: 240,
    defaultPriority: Priority.LOW,
  },
  {
    name: 'Okupim i paligjshëm i pronës komunale',
    departmentName: 'Pronë dhe Çështje Ligjore',
    slaHours: 240,
    defaultPriority: Priority.LOW,
  },
];

const SLA_POLICIES: {
  name: string;
  priority: Priority;
  responseTime: number;
  resolutionTime: number;
  legacyNames: string[];
}[] = [
  {
    name: 'SLA Kritike',
    priority: Priority.CRITICAL,
    responseTime: 60,
    resolutionTime: 1440,
    legacyNames: ['SLA globale — Kritike'],
  },
  {
    name: 'SLA e lartë',
    priority: Priority.HIGH,
    responseTime: 240,
    resolutionTime: 2880,
    legacyNames: ['SLA globale — E lartë'],
  },
  {
    name: 'SLA e mesme',
    priority: Priority.MEDIUM,
    responseTime: 1440,
    resolutionTime: 7200,
    legacyNames: ['SLA globale — Mesatare'],
  },
  {
    name: 'SLA e ulët',
    priority: Priority.LOW,
    responseTime: 2880,
    resolutionTime: 14400,
    legacyNames: ['SLA globale — E ulët'],
  },
];

async function upsertDepartment(
  name: string,
  institutionId: string,
  slaHours: number,
): Promise<{ id: string; name: string }> {
  const aliases = DEPARTMENT_ALIASES[name] ?? [];
  const existing =
    (await prisma.department.findFirst({ where: { name } })) ??
    (aliases.length
      ? await prisma.department.findFirst({ where: { name: { in: aliases } } })
      : null);
  const data = { name, contact: null, institutionId, slaHours };
  if (existing) {
    return prisma.department.update({ where: { id: existing.id }, data });
  }
  return prisma.department.create({ data });
}

async function upsertCategory(
  cat: (typeof CATEGORIES)[number],
  departmentId: string,
): Promise<{ id: string; name: string }> {
  const aliases = CATEGORY_ALIASES[cat.name] ?? [];
  const existing =
    (await prisma.category.findFirst({ where: { name: cat.name } })) ??
    (aliases.length ? await prisma.category.findFirst({ where: { name: { in: aliases } } }) : null);
  const data = {
    name: cat.name,
    departmentId,
    slaHours: cat.slaHours,
    defaultPriority: cat.defaultPriority,
  };
  if (existing) {
    return prisma.category.update({ where: { id: existing.id }, data });
  }
  return prisma.category.create({ data });
}

async function main() {
  const komuna = await prisma.institution.upsert({
    where: { slug: 'komuna-prizren' },
    update: {
      name: 'Komuna e Prizrenit',
      type: 'MUNICIPALITY',
      contact: null,
      active: true,
      integrationType: IntegrationType.MANUAL,
      integrationStatus: IntegrationStatus.NOT_CONFIGURED,
    },
    create: {
      name: 'Komuna e Prizrenit',
      slug: 'komuna-prizren',
      type: 'MUNICIPALITY',
      contact: null,
      active: true,
      integrationType: IntegrationType.MANUAL,
      integrationStatus: IntegrationStatus.NOT_CONFIGURED,
    },
  });

  // Do not seed KEDS / KRU / Eco / Police / Fire — no confirmed mailbox.
  // Deactivate leftover utility institutions from the previous seed and strip emails.
  await prisma.institution.updateMany({
    where: { slug: { not: 'komuna-prizren' } },
    data: {
      contact: null,
      active: false,
      integrationType: IntegrationType.MANUAL,
      integrationStatus: IntegrationStatus.NOT_CONFIGURED,
    },
  });

  const deptByName = new Map<string, { id: string; name: string }>();
  for (const dept of DEPARTMENTS) {
    const row = await upsertDepartment(dept.name, komuna.id, dept.slaHours);
    deptByName.set(dept.name, row);
  }

  const catByName = new Map<string, { id: string; name: string }>();
  for (const cat of CATEGORIES) {
    const dept = deptByName.get(cat.departmentName);
    if (!dept) {
      throw new Error(`Seed missing department "${cat.departmentName}" for category "${cat.name}"`);
    }
    const row = await upsertCategory(cat, dept.id);
    catByName.set(cat.name, row);
  }

  const keepRuleNames = new Set<string>();
  for (const cat of CATEGORIES) {
    const dept = deptByName.get(cat.departmentName);
    const category = catByName.get(cat.name);
    if (!dept || !category) continue;
    const name = `${cat.name} → ${cat.departmentName}`;
    keepRuleNames.add(name);
    const data = {
      name,
      categoryId: category.id,
      subcategory: null,
      severity: null,
      isEmergency: null,
      departmentId: dept.id,
      institutionId: komuna.id,
      priority: 100,
      slaHours: cat.slaHours,
      defaultPriority: cat.defaultPriority,
      active: true,
    };
    const existing = await prisma.routingRule.findFirst({
      where: { OR: [{ name }, { categoryId: category.id }] },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) {
      await prisma.routingRule.update({ where: { id: existing.id }, data });
    } else {
      await prisma.routingRule.create({ data });
    }
  }

  const keepSlaNames = new Set(SLA_POLICIES.map((p) => p.name));
  for (const policy of SLA_POLICIES) {
    const existing = await prisma.slaPolicy.findFirst({
      where: {
        OR: [{ name: policy.name }, { name: { in: policy.legacyNames } }],
      },
    });
    const data = {
      name: policy.name,
      priority: policy.priority,
      responseTime: policy.responseTime,
      resolutionTime: policy.resolutionTime,
      departmentId: null,
      categoryId: null,
      active: true,
    };
    if (existing) {
      await prisma.slaPolicy.update({ where: { id: existing.id }, data });
    } else {
      await prisma.slaPolicy.create({ data });
    }
  }

  const extraRules = await prisma.routingRule.findMany({
    where: { name: { notIn: [...keepRuleNames] } },
  });
  for (const rule of extraRules) {
    await prisma.routingRule.delete({ where: { id: rule.id } });
  }

  const extraPolicies = await prisma.slaPolicy.findMany({
    where: { name: { notIn: [...keepSlaNames] } },
  });
  for (const policy of extraPolicies) {
    await prisma.slaPolicy.delete({ where: { id: policy.id } });
  }

  const keepCatNames = CATEGORIES.map((c) => c.name);
  const extraCats = await prisma.category.findMany({
    where: { name: { notIn: keepCatNames } },
  });
  for (const cat of extraCats) {
    const [reports, rules, policies] = await Promise.all([
      prisma.report.count({ where: { categoryId: cat.id } }),
      prisma.routingRule.count({ where: { categoryId: cat.id } }),
      prisma.slaPolicy.count({ where: { categoryId: cat.id } }),
    ]);
    if (reports + rules + policies === 0) {
      await prisma.category.delete({ where: { id: cat.id } });
    } else {
      console.warn(
        `Kept leftover category "${cat.name}" (${reports} reports, ${rules} rules) — reassign before deleting.`,
      );
    }
  }

  const keepDeptNames = DEPARTMENTS.map((d) => d.name);
  const extraDepts = await prisma.department.findMany({
    where: { name: { notIn: keepDeptNames } },
  });
  for (const dept of extraDepts) {
    const [reports, cats, rules, staff, policies] = await Promise.all([
      prisma.report.count({ where: { departmentId: dept.id } }),
      prisma.category.count({ where: { departmentId: dept.id } }),
      prisma.routingRule.count({ where: { departmentId: dept.id } }),
      prisma.user.count({ where: { departments: { some: { id: dept.id } } } }),
      prisma.slaPolicy.count({ where: { departmentId: dept.id } }),
    ]);
    if (reports + cats + rules + staff + policies === 0) {
      await prisma.department.delete({ where: { id: dept.id } });
    } else {
      await prisma.department.update({
        where: { id: dept.id },
        data: { contact: null },
      });
      console.warn(
        `Kept leftover department "${dept.name}" (in use) — contact stripped; reassign before deleting.`,
      );
    }
  }

  await prisma.department.updateMany({ data: { contact: null } });
  await prisma.institution.updateMany({ data: { contact: null } });

  const extraInstitutions = await prisma.institution.findMany({
    where: { slug: { not: 'komuna-prizren' } },
  });
  for (const inst of extraInstitutions) {
    const [depts, reports, rules] = await Promise.all([
      prisma.department.count({ where: { institutionId: inst.id } }),
      prisma.report.count({ where: { institutionId: inst.id } }),
      prisma.routingRule.count({ where: { institutionId: inst.id } }),
    ]);
    if (depts + reports + rules === 0) {
      await prisma.institution.delete({ where: { id: inst.id } });
    }
  }

  const [deptCount, catCount, ruleCount, slaCount] = await Promise.all([
    prisma.department.count({ where: { institutionId: komuna.id, name: { in: keepDeptNames } } }),
    prisma.category.count({ where: { name: { in: keepCatNames } } }),
    prisma.routingRule.count({ where: { name: { in: [...keepRuleNames] } } }),
    prisma.slaPolicy.count({ where: { name: { in: [...keepSlaNames] } } }),
  ]);

  console.log(
    `Seeded Komuna e Prizrenit (${KOMUNA_PUBLIC_TEL}, ${KOMUNA_ADDRESS}, contact=null): ${deptCount} departments, ${catCount} categories, ${ruleCount} routing rules, ${slaCount} SLA policies.`,
  );
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
