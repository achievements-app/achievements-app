import { PrismaClient } from "@prisma/client";

import { enhancePrisma } from "./enhance-prisma";

const EnhancedPrisma = enhancePrisma(PrismaClient);

export * from "@prisma/client";

export default new EnhancedPrisma();
