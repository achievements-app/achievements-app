// https://github.com/blitz-js/blitz/blob/canary/nextjs/packages/next/stdlib/prisma-utils.ts

import { spawn } from "cross-spawn";
import which from "npm-which";

interface Constructor<T = unknown> {
  new (...args: never[]): T;
}

export interface EnhancedPrismaClientAddedMethods {
  $reset: () => Promise<void>;
}

export interface EnhancedPrismaClientConstructor<
  TPrismaClientCtor extends Constructor
> {
  new (
    ...args: ConstructorParameters<TPrismaClientCtor>
  ): InstanceType<TPrismaClientCtor> & EnhancedPrismaClientAddedMethods;
}

export const enhancePrisma = <TPrismaClientCtor extends Constructor>(
  client: TPrismaClientCtor
): EnhancedPrismaClientConstructor<TPrismaClientCtor> => {
  return new Proxy(
    client as EnhancedPrismaClientConstructor<TPrismaClientCtor>,
    {
      construct(target, args) {
        if (
          typeof window !== "undefined" &&
          process.env.JEST_WORKER_ID === undefined
        ) {
          // Return object with $use method if in the browser
          // Skip in Jest tests because window is defined in Jest tests
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          return { $use: () => {} };
        }

        if (!global._blitz_prismaClient) {
          // eslint-disable-next-line no-shadow
          const client = new target(...(args as any));

          client.$reset = async function reset() {
            if (process.env.NODE_ENV === "production") {
              throw new Error(
                "You are calling db.$reset() in a production environment. We think you probably didn't mean to do that, so we are throwing this error instead of destroying your life's work."
              );
            }

            const prismaBin = which(process.cwd()).sync("prisma");

            await new Promise((res, rej) => {
              const process = spawn(
                prismaBin,
                [
                  "migrate",
                  "reset",
                  "--force",
                  "--skip-generate",
                  "--schema=./libs/data-access-db/src/prisma/schema.prisma"
                ],
                {
                  stdio: "ignore"
                }
              );

              process.on("exit", (code) => (code === 0 ? res(0) : rej(code)));
            });
            global._blitz_prismaClient.$disconnect();
          };

          global._blitz_prismaClient = client;
        }

        return global._blitz_prismaClient;
      }
    }
  );
};
