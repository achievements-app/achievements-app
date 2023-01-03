import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { DbService } from "@/api/shared/db/db.service";

import { PsnModule } from "./psn.module";
import { PsnDataService } from "./psn-data.service";

describe("Service: PsnDataService", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PsnModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    const dbService = app.get(DbService);
    await dbService.enableShutdownHooks(app);

    await app.close();
  });

  it("can instantiate #sanity", () => {
    // ARRANGE
    const psnDataService = app.get(PsnDataService);

    // ASSERT
    expect(psnDataService).toBeTruthy();
  });
});
