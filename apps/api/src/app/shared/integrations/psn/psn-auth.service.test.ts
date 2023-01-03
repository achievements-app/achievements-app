import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import dayjs from "dayjs";
import * as PsnApiModule from "psn-api";
import * as RedisModule from "redis";

import { PsnModule } from "./psn.module";
import { PsnAuthService } from "./psn-auth.service";

describe("Service: PsnAuthService", () => {
  let app: INestApplication;

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it("can instantiate #sanity", async () => {
    // ARRANGE
    const moduleRef = await Test.createTestingModule({
      imports: [PsnModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    const psnAuthService = app.get(PsnAuthService);

    // ASSERT
    expect(psnAuthService).toBeTruthy();
  });

  it("given the service initializes, authorizes with PSN and caches the auth tokens", async () => {
    // ARRANGE
    const mockSet = jest.fn();

    jest.spyOn(RedisModule, "createClient").mockImplementation((): any => ({
      set: mockSet,
      on: jest.fn(),
      connect: jest.fn(),
      get: jest.fn()
    }));

    const moduleRef = await Test.createTestingModule({
      imports: [PsnModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    const psnAuthService = app.get(PsnAuthService);

    jest
      .spyOn(PsnApiModule, "exchangeNpssoForCode")
      .mockResolvedValueOnce("mockAccessCode");

    const exchangeCodeForAccessTokenSpy = jest
      .spyOn(PsnApiModule, "exchangeCodeForAccessToken")
      .mockResolvedValueOnce({
        accessToken: "mockAccessToken",
        expiresIn: 100_000,
        refreshToken: "mockRefreshToken",
        refreshTokenExpiresIn: 300_000,
        idToken: "mockIdToken",
        scope: "mockScope",
        tokenType: "mockTokenType"
      });

    const exchangeRefreshTokenForAuthTokensSpy = jest.spyOn(
      PsnApiModule,
      "exchangeRefreshTokenForAuthTokens"
    );

    // ACT
    await psnAuthService.onModuleInit();

    // ASSERT
    expect(exchangeCodeForAccessTokenSpy).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalled();

    expect(exchangeRefreshTokenForAuthTokensSpy).not.toHaveBeenCalled();
  });

  it("given a cached access token is not expired, returns the cached access token", async () => {
    // ARRANGE
    const mockCachedAuthorization = {
      accessToken: "mockAccessToken",
      refreshToken: "mockRefreshToken",
      accessTokenExpiresOn: dayjs().add(1, "year").toISOString(),
      refreshTokenExpiresOn: dayjs().add(1, "year").toISOString()
    };

    jest.spyOn(RedisModule, "createClient").mockImplementation((): any => ({
      set: jest.fn(),
      on: jest.fn(),
      connect: jest.fn(),
      get: () => JSON.stringify(mockCachedAuthorization)
    }));

    const moduleRef = await Test.createTestingModule({
      imports: [PsnModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    const psnAuthService = app.get(PsnAuthService);

    // ACT
    const authorization = await psnAuthService.usePsnAuthorization();

    // ASSERT
    expect(authorization).toEqual(mockCachedAuthorization);
  });

  it("given a cached access token is expired but the refresh token is not expired, refreshes and returns a new access token", async () => {
    // ARRANGE
    const mockCachedAuthorization = {
      accessToken: "mockAccessToken",
      refreshToken: "mockRefreshToken",
      accessTokenExpiresOn: dayjs().subtract(1, "month").toISOString(),
      refreshTokenExpiresOn: dayjs().add(1, "year").toISOString()
    };

    const mockSet = jest.fn();

    jest.spyOn(RedisModule, "createClient").mockImplementation((): any => ({
      set: mockSet,
      on: jest.fn(),
      connect: jest.fn(),
      get: () => JSON.stringify(mockCachedAuthorization)
    }));

    const exchangeRefreshTokenForAuthTokensSpy = jest
      .spyOn(PsnApiModule, "exchangeRefreshTokenForAuthTokens")
      .mockResolvedValue({
        accessToken: "mockAccessToken",
        expiresIn: 100_000,
        refreshToken: "mockRefreshToken",
        refreshTokenExpiresIn: 300_000,
        idToken: "mockIdToken",
        scope: "mockScope",
        tokenType: "mockTokenType"
      });

    const moduleRef = await Test.createTestingModule({
      imports: [PsnModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    const psnAuthService = app.get(PsnAuthService);

    // ACT
    const authorization = await psnAuthService.usePsnAuthorization();

    // ASSERT
    expect(exchangeRefreshTokenForAuthTokensSpy).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalled();

    expect(authorization.accessToken).toEqual("mockAccessToken");
  });
});
