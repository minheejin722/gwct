import { prisma } from "../db/client.js";
import { createRuntime } from "../runtime.js";

async function replay() {
  const runtime = await createRuntime();

  await prisma.$transaction([
    prisma.notificationLog.deleteMany(),
    prisma.alertEvent.deleteMany(),
    prisma.vesselScheduleChangeEvent.deleteMany(),
    prisma.equipmentLoginEvent.deleteMany(),
    prisma.weatherAlertEvent.deleteMany(),
    prisma.vesselScheduleItem.deleteMany(),
    prisma.craneStatus.deleteMany(),
    prisma.equipmentLoginStatus.deleteMany(),
    prisma.yTCountSnapshot.deleteMany(),
    prisma.weatherNoticeSnapshot.deleteMany(),
    prisma.parseError.deleteMany(),
    prisma.rawSnapshot.deleteMany(),
    prisma.scrapeRun.deleteMany(),
  ]);

  await runtime.monitorService.runAllOnce({ mode: "fixture", fixtureSet: "step1" });
  await runtime.monitorService.runAllOnce({ mode: "fixture", fixtureSet: "step2" });

  const alerts = await runtime.repo.getRecentAlerts(20);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      alerts.map((row) => ({
        id: row.id,
        category: row.category,
        type: row.type,
        title: row.title,
        occurredAt: row.occurredAt,
      })),
      null,
      2,
    ),
  );

  await runtime.browserPool.close();
  await runtime.app.close();
  await prisma.$disconnect();
}

replay().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
