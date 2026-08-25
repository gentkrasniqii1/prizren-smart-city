import { IntegrationStatus, IntegrationType, Priority, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Verified public channels only. `contact` is email; `phone` is the switchboard.
 * Office numbers / street address for Komuna are documented here, not stored as email:
 * zyrë 038 200 44-702 / 44-722, Remzi Ademaj p.n., Prizren 20000.
 */
const INSTITUTIONS: {
  name: string;
  slug: string;
  aliases?: string[];
  type: string;
  phone: string | null;
  contact: string | null;
  socialContact?: string | null;
}[] = [
  {
    name: 'Komuna e Prizrenit',
    slug: 'komuna-prizren',
    type: 'MUNICIPALITY',
    phone: '0800 11 002',
    // Confirmed: no public email exists (prizren.rks-gov.net/kontakt/, and Facebook Contact Info lists only phone/Messenger).
    contact: null,
    // Official Facebook page, confirmed via Contact Info: phone + Messenger only, no email.
    socialContact: 'https://www.facebook.com/kkprizren',
  },
  {
    name: 'KEDS',
    slug: 'keds',
    type: 'UTILITY',
    phone: '0800 791 00',
    // Cloudflare email-protection hashes on keds-energy.com/shq/rreth-nesh/si-te-na-kontaktoni/
    // all decode to this address; also printed in plaintext on the Call Center news page.
    contact: 'info@keds-energy.com',
  },
  {
    name: 'Hidroregjioni Jugor',
    slug: 'hidroregjioni-jugor',
    aliases: ['kru-prizreni'],
    type: 'UTILITY',
    phone: '0800 44000',
    // Confirmed by user against hidroregjioni-jugor.com/kontakt/
    contact: 'info@hidroregjioni-jugor.com',
  },
  {
    name: 'Eco-Regjioni',
    slug: 'eco-regjioni',
    type: 'UTILITY',
    phone: '029 241 167',
    // Confirmed via Eco-Regjioni's official Facebook page (facebook.com/profile.php?id=61578207656755),
    // "KRM Eko Regjioni SH.A - Njësia Operative Prizren", Contact Info section — listed in plaintext,
    // independent of the Cloudflare-obfuscated address on ekoregjioni.com/zyret-kontaktuese/.
    contact: 'info@ekoregjioni.com',
  },
];

const KEEP_INSTITUTION_SLUGS = INSTITUTIONS.map((i) => i.slug);

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

/**
 * Official direct lines from Komuna e Prizrenit's "Telefonat me rëndësi" page.
 * Pronë dhe Çështje Ligjore has two offices, not one number: Zyra për Çështje
 * të Pronës (747) and Zyra Ligjore (781). Keep both, do not collapse to one.
 */
const DEPARTMENTS: { name: string; slaHours: number; contact: string | null }[] = [
  { name: 'Administratë', slaHours: 168, contact: '038 200 44 728' },
  { name: 'Ekonomi dhe Financave', slaHours: 168, contact: '038 200 44 738' },
  { name: 'Shërbime Publike', slaHours: 48, contact: '038 200 44 730' },
  { name: 'Urbanizëm dhe Planifikim Hapësinor', slaHours: 72, contact: '038 200 44 731' },
  { name: 'Inspektorate', slaHours: 48, contact: '038 200 44 708' },
  { name: 'Bujqësi dhe Zhvillim Rural', slaHours: 240, contact: '038 200 44 733' },
  { name: 'Gjeodezi dhe Kadastër', slaHours: 168, contact: '038 200 44 736' },
  { name: 'Kulturë, Rini dhe Sport', slaHours: 120, contact: '038 200 44 734' },
  { name: 'Arsim dhe Shkencë', slaHours: 48, contact: '038 200 44 737' },
  { name: 'Emergjencë dhe Siguri', slaHours: 24, contact: '038 200 44 732' },
  { name: 'Turizëm dhe Zhvillim Ekonomik', slaHours: 168, contact: '038 200 44 710' },
  { name: 'Shëndetësi', slaHours: 48, contact: '038 200 44 735' },
  { name: 'Punë dhe Mirëqenie Sociale', slaHours: 168, contact: '038 200 44 711' },
  {
    name: 'Pronë dhe Çështje Ligjore',
    slaHours: 240,
    contact: '038 200 44 747 / 038 200 44 781', // Zyra e Pronës / Zyra Ligjore
  },
];

const CATEGORIES: {
  name: string;
  departmentName: string;
  slaHours: number;
  defaultPriority: Priority;
  /** Overrides RoutingRule.institutionId; department stays municipal. */
  institutionSlug?: string;
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
    institutionSlug: 'eco-regjioni',
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
    institutionSlug: 'hidroregjioni-jugor',
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

/**
 * DRAFT taxonomy for admin review — not verified municipal policy.
 * Edit/delete via /admin/routing → Subcategories after seed.
 */
const SUBCATEGORIES: Record<string, string[]> = {
  'Grope / dëmtim rruge': ['Gropë në rrugë', 'Asfalt i dëmtuar', 'Buzë trotuari e thyer'],
  'Ndriçim publik i prishur': ['Llambë e djegur', 'Shtyllë e dëmtuar', 'Errësirë e zgjatur'],
  'Grumbullim mbeturinash / konteiner': [
    'Konteiner i mbushur',
    'Konteiner i dëmtuar',
    'Grumbullim i vonuar',
  ],
  'Kanalizim / përmbytje urbane': [
    'Pusetë e bllokuar',
    'Përmbytje e rrugës',
    'Rrjedhje kanalizimi',
  ],
  'Ujë i pijshëm (ndërprerje / cilësi)': [
    'Ndërprerje uji',
    'Ujë i turbullt / cilësi',
    'Rrjedhje në rrjet',
  ],
  'Parke, pemë, hapësirë e gjelbër': [
    'Pemë e dëmtuar / e rrezikshme',
    'Park i papastër',
    'Mobilier parkesh e dëmtuar',
  ],
  'Ndërtim pa leje / shkelje urbanistike': [
    'Ndërtim pa leje',
    'Shkelje e kufirit të ndërtimit',
    'Ndryshim fasade pa leje',
  ],
  'Pengesë në trotuar / qasje': [
    'Automjet në trotuar',
    'Pengesë e përhershme',
    'Qasje e kufizuar për persona me aftësi të kufizuara',
  ],
  'Hedhje e paligjshme / ndotje': [
    'Hedhje e paligjshme mbeturinash',
    'Ndotje e hapësirës publike',
    'Djegie e paligjshme',
  ],
  'Zhurmë / shqetësim në lagje': ['Zhurmë nga lokali', 'Zhurmë nga ndërtimi', 'Shqetësim natën'],
  'Rrezik zjarri / emergjencë': ['Rrezik zjarri', 'Material i rrezikshëm', 'Emergjencë tjetër'],
  'Sinjalistikë / rrezik në trafik': [
    'Sinjalistikë e dëmtuar',
    'Shenjë e munguar',
    'Rrezik në kryqëzim',
  ],
  'Monument / trashëgimi e dëmtuar': [
    'Monument i dëmtuar',
    'Vandalizëm në trashëgimi',
    'Mirëmbajtje monumenti',
  ],
  'Infrastrukturë shkollore e rrezikshme': [
    'Oborr / hyrje e rrezikshme',
    'Ndërtesë shkollore e dëmtuar',
    'Pajisje lojërash e dëmtuar',
  ],
  'Infrastrukturë e kujdesit shëndetësor komunal': [
    'Qasje e vështirësuar',
    'Infrastrukturë e dëmtuar',
    'Ambjent i papastër / i pasigurt',
  ],
  'Tjetër / e paklasifikuar': ['Raport i përgjithshëm', 'Kërkesë e papërcaktuar'],
  'Kafshë endacake': ['Qen endacak', 'Mace endacake', 'Kafshë e lënduar'],
  'Okupim i paligjshëm i pronës komunale': [
    'Okupim i hapësirës publike',
    'Ndërtim në pronë komunale',
    'Pengesë në pronë komunale',
  ],
};

/**
 * Villages/settlements of Prizren Municipality — provided directly by the project owner.
 * Do not add, remove, rename, or reformat entries without an explicit request; this is
 * user-supplied source data, not AI-researched.
 */
const ZONES: { name: string }[] = [
  { name: 'Sërbicë e Epërme' },
  { name: 'Lubinjë e Epërme' },
  { name: 'Gorjnasellë' },
  { name: 'Gorozhup' },
  { name: 'Grozhdanik' },
  { name: 'Gërnqar' },
  { name: 'Hoçë e Qytetit' },
  { name: 'Jabllanicë' },
  { name: 'Jeshkovë' },
  { name: 'Kabash' },
  { name: 'Kabash i Hasit' },
  { name: 'Karashëngjergj' },
  { name: 'Kobajë' },
  { name: 'Kojushë' },
  { name: 'Korishë' },
  { name: 'Krajk' },
  { name: 'Kushnin' },
  { name: 'Kushtendil' },
  { name: 'Landovicë' },
  { name: 'Leskovec' },
  { name: 'Lez' },
  { name: 'Lubiqevë' },
  { name: 'Lubizhdë' },
  { name: 'Lubizhdë e Hasit I' },
  { name: 'Lubizhdë e Hasit II' },
  { name: 'Lukinaj' },
  { name: 'Lutogllavë' },
  { name: 'Llokvicë' },
  { name: 'Krushë e Vogël' },
  { name: 'Manastiricë' },
  { name: 'Mazrekë' },
  { name: 'Medvec' },
  { name: 'Milaj' },
  { name: 'Mushnikovë' },
  { name: 'Nashec' },
  { name: 'Nebregosht' },
  { name: 'Novak' },
  { name: 'Novosellë' },
  { name: 'Petrovë' },
  { name: 'Piranë' },
  { name: 'Pllanejë' },
  { name: 'Pllanjan' },
  { name: 'Poslishtë' },
  { name: 'Randobravë' },
  { name: 'Reçan' },
  { name: 'Romajë' },
  { name: 'Skorobishtë' },
  { name: 'Smaç' },
  { name: 'Shpenadi' },
  { name: 'Sredskë' },
  { name: 'Struzhë' },
  { name: 'Trepetincë' },
  { name: 'Tupec' },
  { name: 'Velezhë' },
  { name: 'Vlashnjë' },
  { name: 'Vërbiçan' },
  { name: 'Vërmicë' },
  { name: 'Zhivinjan' },
  { name: 'Zym' },
  { name: 'Zojz' },
  { name: 'Zhur' },
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
  contact: string | null,
): Promise<{ id: string; name: string }> {
  const aliases = DEPARTMENT_ALIASES[name] ?? [];
  const existing =
    (await prisma.department.findFirst({ where: { name } })) ??
    (aliases.length
      ? await prisma.department.findFirst({ where: { name: { in: aliases } } })
      : null);
  const data = { name, contact, institutionId, slaHours };
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

async function upsertSubcategory(
  categoryId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  const existing = await prisma.subcategory.findUnique({
    where: { categoryId_name: { categoryId, name } },
  });
  const data = { name, categoryId, active: true };
  if (existing) {
    return prisma.subcategory.update({ where: { id: existing.id }, data });
  }
  return prisma.subcategory.create({ data });
}

async function upsertZone(name: string): Promise<{ id: string; name: string }> {
  const existing = await prisma.zone.findUnique({ where: { name } });
  const data = { name, active: true };
  if (existing) {
    return prisma.zone.update({ where: { id: existing.id }, data });
  }
  return prisma.zone.create({ data });
}

async function upsertSeedInstitution(inst: (typeof INSTITUTIONS)[number]) {
  const existing =
    (await prisma.institution.findUnique({ where: { slug: inst.slug } })) ??
    (inst.aliases?.length
      ? await prisma.institution.findFirst({ where: { slug: { in: inst.aliases } } })
      : null);
  const data = {
    name: inst.name,
    slug: inst.slug,
    type: inst.type,
    phone: inst.phone,
    contact: inst.contact,
    socialContact: inst.socialContact ?? null,
    active: true,
    integrationType: IntegrationType.MANUAL,
    integrationStatus: IntegrationStatus.NOT_CONFIGURED,
  };
  if (existing) {
    return prisma.institution.update({ where: { id: existing.id }, data });
  }
  return prisma.institution.create({ data });
}

async function main() {
  const seeded = new Map<string, { id: string }>();
  for (const inst of INSTITUTIONS) {
    const row = await upsertSeedInstitution(inst);
    seeded.set(inst.slug, row);
  }
  const komuna = seeded.get('komuna-prizren');
  if (!komuna) throw new Error('Seed missing Komuna e Prizrenit');

  const prune = process.env.SEED_PRUNE === 'true';
  if (prune) {
    await prisma.institution.updateMany({
      where: { slug: { notIn: KEEP_INSTITUTION_SLUGS } },
      data: {
        contact: null,
        phone: null,
        active: false,
        integrationType: IntegrationType.MANUAL,
        integrationStatus: IntegrationStatus.NOT_CONFIGURED,
      },
    });
  }

  const deptByName = new Map<string, { id: string; name: string }>();
  for (const dept of DEPARTMENTS) {
    const row = await upsertDepartment(dept.name, komuna.id, dept.slaHours, dept.contact);
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

  let subcategoryCount = 0;
  for (const [categoryName, names] of Object.entries(SUBCATEGORIES)) {
    const category = catByName.get(categoryName);
    if (!category) {
      throw new Error(`Seed SUBCATEGORIES references unknown category "${categoryName}"`);
    }
    for (const name of names) {
      await upsertSubcategory(category.id, name);
      subcategoryCount += 1;
    }
  }

  // Upsert owner-provided settlement zones (find-or-create by unique name).
  let zoneCount = 0;
  for (const zone of ZONES) {
    await upsertZone(zone.name);
    zoneCount += 1;
  }

  const keepRuleNames = new Set<string>();
  for (const cat of CATEGORIES) {
    const dept = deptByName.get(cat.departmentName);
    const category = catByName.get(cat.name);
    if (!dept || !category) continue;
    const institutionForCategory = cat.institutionSlug ? seeded.get(cat.institutionSlug) : komuna;
    if (!institutionForCategory) {
      throw new Error(
        `Seed missing institution "${cat.institutionSlug}" for category "${cat.name}"`,
      );
    }
    const name = `${cat.name} → ${cat.departmentName}`;
    keepRuleNames.add(name);
    const data = {
      name,
      categoryId: category.id,
      subcategory: null,
      severity: null,
      isEmergency: null,
      departmentId: dept.id,
      institutionId: institutionForCategory.id,
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

  const keepCatNames = CATEGORIES.map((c) => c.name);
  const keepDeptNames = DEPARTMENTS.map((d) => d.name);

  if (prune) {
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

    const extraInstitutions = await prisma.institution.findMany({
      where: { slug: { notIn: KEEP_INSTITUTION_SLUGS } },
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
  }

  const [deptCount, catCount, ruleCount, slaCount] = await Promise.all([
    prisma.department.count({ where: { institutionId: komuna.id, name: { in: keepDeptNames } } }),
    prisma.category.count({ where: { name: { in: keepCatNames } } }),
    prisma.routingRule.count({ where: { name: { in: [...keepRuleNames] } } }),
    prisma.slaPolicy.count({ where: { name: { in: [...keepSlaNames] } } }),
  ]);

  console.log(
    `Seeded ${KEEP_INSTITUTION_SLUGS.join(', ')}: ${deptCount} municipal departments, ${catCount} categories, ${subcategoryCount} draft subcategories, ${zoneCount} zones, ${ruleCount} routing rules, ${slaCount} SLA policies. Waste → Eco-Regjioni, drinking water → Hidroregjioni Jugor; other rules stay Komuna. Institution.contact is email-only; unused mailboxes stay null.`,
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
