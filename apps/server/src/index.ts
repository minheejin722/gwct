import { prisma } from "./db/client.js";
import { createRuntime } from "./runtime.js";
import { env } from "./config/env.js";

async function main() {
  const runtime = await createRuntime();
  const rawPort = Number(process.env.PORT ?? 4000);
  const port = Number.isFinite(rawPort) ? rawPort : 4000;

  await runtime.app.listen({
    host: env.HOST,
    port,
  });

  runtime.app.log.info({ port }, "GWCT monitor server started");

  await runtime.scheduler.start();
  runtime.cleanupScheduler.start();

  const shutdown = async (signal: string) => {
    runtime.app.log.info({ signal }, "shutting down");
    runtime.scheduler.stop();
    runtime.cleanupScheduler.stop();
    await runtime.browserPool.close();
    await runtime.app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
