import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { db } from "@achievements-app/data-access-db";
import { createUser } from "@achievements-app/utils-db";

import { DbService } from "@/api/shared/db/db.service";

import type { AddTrackedAccountPayload } from "./models";
import { PublicController } from "./public.controller";
import { PublicModule } from "./public.module";

describe("Controller: PublicController", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PublicModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    const dbService = app.get(DbService);
    await dbService.enableShutdownHooks(app);

    await app.close();
  });

  it("can instantiate #sanity", () => {
    // ARRANGE
    const publicController = app.get(PublicController);

    // ASSERT
    expect(publicController).toBeTruthy();
  });

  it("can add a new TrackedAccount entity to an existing user", async () => {
    // ARRANGE
    const addedUser = await createUser();

    const payload: AddTrackedAccountPayload = {
      gamingService: "PSN",
      userName: addedUser.userName,
      serviceAccountUserName: "mockServiceAccountUserName"
    };

    // ACT
    const response = await request(app.getHttpServer())
      .post("/public/user/trackedAccount")
      .send(payload);

    // ASSERT
    expect(response.status).toEqual(201);

    const foundUser = await db.user.findFirst({
      include: { trackedAccounts: true }
    });

    expect(foundUser.trackedAccounts.length).toEqual(
      addedUser.trackedAccounts.length + 1
    );
  });

  it("can return a list of all high priority users in the DB", async () => {
    // ARRANGE
    await createUser();
    await createUser();
    const highPriorityUser = await createUser({ syncPriority: "High" });

    // ACT
    const response = await request(app.getHttpServer()).get(
      "/public/user/highPriority"
    );

    // ASSERT
    expect(response.status).toEqual(200);
    expect((response.body as unknown[]).length).toEqual(1);
    expect(response.body[0].userName).toEqual(highPriorityUser.userName);
  });

  it("can remove a tracked account from a user", async () => {
    // ARRANGE
    const newUser = await createUser();

    const newUserPsnTrackedAccount = newUser.trackedAccounts.find(
      (trackedAccount) => trackedAccount.gamingService === "PSN"
    );

    // ACT
    await request(app.getHttpServer())
      .delete("/public/user/trackedAccount")
      .send({
        gamingService: "PSN",
        serviceAccountUserName: newUserPsnTrackedAccount.accountUserName
      });

    // ASSERT
    const foundUser = await db.user.findFirst({
      include: { trackedAccounts: true }
    });

    expect(foundUser.userName).toEqual(newUser.userName);
    expect(foundUser.trackedAccounts.length).toEqual(
      newUser.trackedAccounts.length - 1
    );
  });
});
