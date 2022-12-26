import type { XboxTitleMetadata } from "./xbox-title-metadata.model";

export interface FetchXboxTitleMetadataResponse {
  xuid: string;

  // The Xbox API will return an error rather than an empty array.
  titles: [XboxTitleMetadata];
}
