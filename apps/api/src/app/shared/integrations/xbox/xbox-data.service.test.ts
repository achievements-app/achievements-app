import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { XboxModule } from "./xbox.module";
import { XboxDataService } from "./xbox-data.service";

describe("Service: XboxDataService", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [XboxModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("can instantiate #sanity", () => {
    // ARRANGE
    const xboxDataService = app.get(XboxDataService);

    // ASSERT
    expect(xboxDataService).toBeTruthy();
  });
});
