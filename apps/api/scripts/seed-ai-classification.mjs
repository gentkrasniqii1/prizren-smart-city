import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const report = await prisma.report.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!report) {
    console.log('no_report');
    return;
  }
  const classification = {
    category: 'road_damage',
    severity: 'high',
    confidence: 0.42,
    summary: 'Pothole near center',
    recommendedDepartment: 'Rruga & Infrastrukturë',
  };
  await prisma.report.update({
    where: { id: report.id },
    data: {
      aiClassification: classification,
      aiConfidence: 0.42,
      status: 'UNDER_REVIEW',
    },
  });
  console.log('reportId=' + report.id);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
