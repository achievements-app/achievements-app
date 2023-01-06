import type { MappedGame } from "@achievements-app/data-access-common-models";

export type ThinMappedGame = Pick<
  MappedGame,
  "serviceTitleId" | "name" | "knownUserEarnedAchievementCount"
>;
