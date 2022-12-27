import { call } from "@xboxreplay/xboxlive-api";
import { RateLimiter } from "limiter";

const limiter = new RateLimiter({ tokensPerInterval: 70, interval: "minute" });

export async function limitedXboxCall<T>(...args: Parameters<typeof call>) {
  const remainingRequestsPerMinute = await limiter.removeTokens(1);
  console.log({ remainingRequestsPerMinute });

  return call<T>(...args);
}
