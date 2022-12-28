/* eslint-disable no-console */

import type { GamingService, PrismaPromise } from "../index";
import db from "../index";

interface NewUser {
  userName: string;
  discordId: string;
  trackedAccounts: Array<{
    accountUserName: string;
    gamingService: GamingService;
  }>;
}

const newUsers: NewUser[] = [
  {
    userName: "wc",
    discordId: "199221906061131785",
    trackedAccounts: [
      { accountUserName: "WCopeland", gamingService: "RA" },
      { accountUserName: "UsableDayv", gamingService: "XBOX" },
      { accountUserName: "WCopeland1", gamingService: "XBOX" },
      { accountUserName: "ViaFix", gamingService: "XBOX" },
      { accountUserName: "HippopotamusRex", gamingService: "RA" }
    ]
  },
  {
    userName: "rayfinkel",
    discordId: "364942899118604299",
    trackedAccounts: [{ accountUserName: "Rayfinkel", gamingService: "RA" }]
  },
  {
    userName: "Barra",
    discordId: "340654527613239297",
    trackedAccounts: [{ accountUserName: "Barra", gamingService: "RA" }]
  },
  {
    userName: "mameshame",
    discordId: "173640741493538816",
    trackedAccounts: [{ accountUserName: "mameshane", gamingService: "RA" }]
  },
  {
    userName: "AaronTruitt",
    discordId: "160628789859188736",
    trackedAccounts: [{ accountUserName: "AaronTruitt", gamingService: "RA" }]
  },
  {
    userName: "Flobeamer1922",
    discordId: "157918282278502400",
    trackedAccounts: [{ accountUserName: "Flobeamer1922", gamingService: "RA" }]
  },
  {
    userName: "xelnia",
    discordId: "280439586537340929",
    trackedAccounts: [{ accountUserName: "xelnia", gamingService: "RA" }]
  },
  {
    userName: "markussd",
    discordId: "198285442519400448",
    trackedAccounts: [{ accountUserName: "markussd", gamingService: "RA" }]
  },
  {
    userName: "dollopuss",
    discordId: "322408168711782400",
    trackedAccounts: [{ accountUserName: "dollopuss", gamingService: "RA" }]
  },
  {
    userName: "dznduke",
    discordId: "404073545875062784",
    trackedAccounts: [{ accountUserName: "dznduke", gamingService: "RA" }]
  },
  {
    userName: "ILLSeaBass",
    discordId: "221008024905449472",
    trackedAccounts: [{ accountUserName: "ILLSeaBass", gamingService: "RA" }]
  },
  {
    userName: "syscrusher",
    discordId: "328771565934215169",
    trackedAccounts: [{ accountUserName: "syscrusher", gamingService: "RA" }]
  },
  {
    userName: "Kibbey93",
    discordId: "130672053077540864",
    trackedAccounts: [{ accountUserName: "Kibbey93", gamingService: "RA" }]
  },
  {
    userName: "wvpinball",
    discordId: "739536437363605576",
    trackedAccounts: [{ accountUserName: "wvpinball", gamingService: "RA" }]
  },
  {
    userName: "krehztim",
    discordId: "196793968665690122",
    trackedAccounts: [{ accountUserName: "krehztim", gamingService: "RA" }]
  },
  {
    userName: "DuggerVideoGames",
    discordId: "405083527831355412",
    trackedAccounts: [
      { accountUserName: "DuggerVideoGames", gamingService: "RA" }
    ]
  },
  {
    userName: "Prow7",
    discordId: "287810926327889924",
    trackedAccounts: [{ accountUserName: "Prow7", gamingService: "RA" }]
  },
  {
    userName: "ElBurro",
    discordId: "891952798617456681",
    trackedAccounts: [{ accountUserName: "ElBurro", gamingService: "RA" }]
  },
  {
    userName: "5pectre",
    discordId: "539327871827705857",
    trackedAccounts: [{ accountUserName: "5pectre", gamingService: "RA" }]
  },
  {
    userName: "QRS666",
    discordId: "514823024327786530",
    trackedAccounts: [{ accountUserName: "QRS666", gamingService: "RA" }]
  },
  {
    userName: "NWnike",
    discordId: "511878335790448640",
    trackedAccounts: [{ accountUserName: "NWnike", gamingService: "RA" }]
  },
  {
    userName: "Buhh",
    discordId: "337802632586592256",
    trackedAccounts: [{ accountUserName: "Buhh", gamingService: "RA" }]
  },
  {
    userName: "Chrispy",
    discordId: "378867986448252929",
    trackedAccounts: [{ accountUserName: "Chrispy", gamingService: "RA" }]
  }
];

export const seedUsers = async () => {
  await db.$connect();

  console.log("🌱  Seeding users...");

  const batchOperations: PrismaPromise<any>[] = [];
  for (const newUser of newUsers) {
    batchOperations.push(
      db.user.create({
        data: {
          userName: newUser.userName,
          discordId: newUser.discordId,
          trackedAccounts: {
            createMany: {
              data: newUser.trackedAccounts
            }
          }
        }
      })
    );
  }

  await db.$transaction(batchOperations);

  console.log(`🌱  Seeded ${newUsers.length} users.`);

  await db.$disconnect();
};
