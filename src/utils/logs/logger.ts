import pino from "pino";

import { isProduction } from "app/config/env.js";

const isProd = isProduction();

export const logger = pino({
  level: isProd ? "info" : "debug",
  // base structured JSON logs in all environments
  ...(isProd
    ? {}
    : {
        // pretty-print only in development
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      }),
});
