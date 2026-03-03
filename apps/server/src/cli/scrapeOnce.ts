import { prisma } from "../db/client.js";
import { createRuntime } from "../runtime.js";

async function run() {
  const runtime = await createRuntime();
  await runtime.monitorService.runAllOnce();

  const [vessels, cranes, equipment, yt, weather] = await Promise.all([
    runtime.repo.getLatestVesselItems("gwct_schedule_list"),
    runtime.repo.getLatestCraneStatuses("gwct_work_status"),
    runtime.repo.getLatestEquipmentStatuses("gwct_equipment_status"),
    runtime.repo.getLatestYtSnapshot("gwct_equipment_status"),
    runtime.repo.getLatestWeatherSnapshot("ys_forecast"),
  ]);

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        vessels: vessels.slice(0, 5),
        cranes: cranes.slice(0, 5),
        equipment: equipment.slice(0, 5),
        yt,
        weather,
      },
      null,
      2,
    ),
  );

  await runtime.browserPool.close();
  await runtime.app.close();
  await prisma.$disconnect();
}

run().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
