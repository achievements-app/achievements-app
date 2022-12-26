const toHex = (originalValue: number) => {
  return originalValue.toString(16).toUpperCase();
};

/**
 * Legacy Xbox achievements, mostly for the Xbox 360 platform,
 * use image URLs constructed from hex values derived from the
 * title ID and image ID.
 */
export const buildLegacyAchievementImageUrl = (
  achievementTitleId: number,
  achievementImageId: number
) => {
  const hexTitleId = toHex(achievementTitleId);
  const hexImageId = toHex(achievementImageId);

  return `http://image.xboxlive.com/global/t.${hexTitleId}/ach/0/${hexImageId}`;
};
