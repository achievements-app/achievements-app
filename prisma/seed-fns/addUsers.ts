import db from "../index";

export const addUsers = async () => {
  await db.$connect();

  console.log("🌱  Seeding users...");
  await db.user.create({
    data: {
      userName: "wc",
      discordId: "199221906061131785",
      trackedAccounts: {
        createMany: {
          data: [{ accountUserName: "WCopeland", gamingService: "RA" }]
        }
      }
    }
  });

  await db.$disconnect();
};
