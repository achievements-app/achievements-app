import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const host = process.env["REDISHOST"];
  const password = process.env["REDISPASSWORD"];
  const port = process.env["REDISPORT"];
  const user = process.env["REDISUSER"];

  const redisClient = createClient({
    url: `redis://${user}:${password}@${host}:${port}`
  });

  console.log("\nš”  Connecting to Redis...");
  await redisClient.connect();

  console.log("š«”  Purging Redis...");
  await redisClient.flushAll();

  console.log("š  Purged.\n");
  process.exit();
}

main();
