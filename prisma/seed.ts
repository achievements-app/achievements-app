import * as seedFns from "./seed-fns";

const seed = async () => {
  console.log("🚀  Seeding achievements.app DB.");

  await seedFns.addUsers();
};

seed();
