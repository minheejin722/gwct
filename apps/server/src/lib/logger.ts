import type { FastifyBaseLogger } from "fastify";

export const baseLoggerConfig = {
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : {
          target: "pino-pretty",
          options: {
            translateTime: "SYS:standard",
            singleLine: true,
          },
        },
};

export type AppLogger = FastifyBaseLogger;
