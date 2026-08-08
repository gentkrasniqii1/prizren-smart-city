const { PrismaClient } = require('@prisma/client');

async function main() {
  const p = new PrismaClient();
  const r = await p.report.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!r) {
    console.log('no_report');
    await p.$disconnect();
    return;
  }
  const classification = {
    category: 'road_damage',
    severity: 'high',
    confidence: 0.42,
    summary: 'Pothole near center',
    recommendedDepartment: 'Rruga & Infrastrukturë',
  };
  await p.report.update({
    where: { id: r.id },
    data: {
      aiClassification: classification,
      aiConfidence: 0.42,
      status: 'IN_REVIEW',
    },
  });
  console.log('reportId=' + r.id);
  await p.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
