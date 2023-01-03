import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { DbService } from "@/api/shared/db/db.service";

import { AppController } from "./app.controller";
import { AppModule } from "./app.module";

describe("Controller: AppController", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
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
    const appController = app.get(AppController);

    // ASSERT
    expect(appController).toBeTruthy();
  });

  it("has a working healthcheck endpoint so it does not crash on production deployments", async () => {
    // ACT
    const response = await request(app.getHttpServer()).get("/health");

    // ASSERT
    expect(response.status).toEqual(200);
  });
});
