import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { db } from "@achievements-app/data-access-db";
import { createGame } from "@achievements-app/utils-db";

import { DbModule } from "./db.module";
import { DbService } from "./db.service";

describe("Service: DbService", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DbModule]
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
    const dbService = app.get(DbService);

    // ASSERT
    expect(dbService).toBeTruthy();
  });

  describe("Method: getMultipleGamesExistenceStatus", () => {
    it("given a list of serviceTitleIds, returns a list of games that are missing", async () => {
      // ARRANGE
      const mockServiceTitleIds = ["12345", "23456", "34567", "45678"];

      const dbService = app.get(DbService);

      // ACT
      const { missingGameServiceTitleIds } =
        await dbService.getMultipleGamesExistenceStatus(
          "RA",
          mockServiceTitleIds
        );

      // ASSERT
      expect(missingGameServiceTitleIds).toEqual(mockServiceTitleIds);
    });

    it("given a list of serviceTitleIds, returns a list of games that exist in the database", async () => {
      // ARRANGE
      const mockServiceTitleIds = ["12345", "23456", "34567", "45678"];

      await db.$transaction([
        createGame({
          serviceTitleId: mockServiceTitleIds[0],
          gamingService: "RA"
        }),
        createGame({
          serviceTitleId: mockServiceTitleIds[1],
          gamingService: "RA"
        }),
        createGame({
          serviceTitleId: mockServiceTitleIds[2],
          // Intentionally using the wrong service, so this
          // title ID should show up as missing.
          gamingService: "XBOX"
        })
      ]);

      const dbService = app.get(DbService);

      // ACT
      const { existingGameServiceTitleIds, missingGameServiceTitleIds } =
        await dbService.getMultipleGamesExistenceStatus(
          "RA",
          mockServiceTitleIds
        );

      // ASSERT
      expect(existingGameServiceTitleIds).toContain(mockServiceTitleIds[0]);
      expect(existingGameServiceTitleIds).toContain(mockServiceTitleIds[1]);

      expect(missingGameServiceTitleIds).toContain(mockServiceTitleIds[2]);
      expect(missingGameServiceTitleIds).toContain(mockServiceTitleIds[3]);
    });

    it("given a list of serviceTitleIds, returns a list of games that exist but are flagged as stale", async () => {
      // ARRANGE
      const mockServiceTitleIds = ["12345", "23456", "34567", "45678"];

      await db.$transaction([
        createGame({
          serviceTitleId: mockServiceTitleIds[0],
          gamingService: "RA"
        }),
        createGame({
          serviceTitleId: mockServiceTitleIds[1],
          gamingService: "RA",
          isStale: true
        }),
        createGame({
          serviceTitleId: mockServiceTitleIds[2],
          // Intentionally using the wrong service, so this
          // title ID should show up as missing.
          gamingService: "XBOX"
        })
      ]);

      const dbService = app.get(DbService);

      // ACT
      const { existingGameServiceTitleIds, staleGameServiceTitleIds } =
        await dbService.getMultipleGamesExistenceStatus(
          "RA",
          mockServiceTitleIds
        );

      // ASSERT
      expect(existingGameServiceTitleIds).toContain(mockServiceTitleIds[0]);
      expect(existingGameServiceTitleIds).not.toContain(mockServiceTitleIds[1]);

      expect(staleGameServiceTitleIds).not.toContain(mockServiceTitleIds[0]);
      expect(staleGameServiceTitleIds).toContain(mockServiceTitleIds[1]);
    });
  });
});
