// Ref: https://blog.ludicroushq.com/a-better-way-to-run-integration-tests-with-prisma-and-postgresql

import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import { join } from "path";
import { URL } from "url";
import { v4 } from "uuid";

const generateDatabaseURL = (schema: string) => {
  if (!process.env.DATABASE_URL) {
    throw new Error("please provide a database url");
  }

  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.append("schema", schema);

  return url.toString();
};

const schemaId = `test-${v4()}`;
const prismaBinary = join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "node_modules",
  ".bin",
  "prisma"
);

const url = generateDatabaseURL(schemaId);
process.env.DATABASE_URL = url;

export const db = new PrismaClient({
  datasources: { db: { url } }
});

beforeEach(() => {
  execSync(
    `${prismaBinary} db push --schema=./libs/data-access-db/src/prisma/schema.prisma`,
    {
      env: {
        ...process.env,
        DATABASE_URL: generateDatabaseURL(schemaId)
      }
    }
  );
});

afterEach(async () => {
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaId}" CASCADE;`);
  await db.$disconnect();
});
