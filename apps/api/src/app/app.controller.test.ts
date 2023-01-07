import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AppController } from "./app.controller";

describe("Controller: AppController", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
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
