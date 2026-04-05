import { app } from "./app.js";
import { env } from "./env.js";

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
