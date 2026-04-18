import { app } from "./app.js";
import { env } from "./env.js";
import { logger } from "./logger.js";

app.listen(env.port, () => {
  logger.info({ port: env.port }, 'Server listening')
});
