import { app } from "./app";
import { env } from "./env";

(async () => {
  const serverName = await app.listen({ port: env.APP_PORT });

  console.log(`Application "${env.APP_NAME}" is running!`);
  console.log(serverName);
})();
