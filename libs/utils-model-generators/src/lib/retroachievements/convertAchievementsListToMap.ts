export const convertAchievementsListToMap = (
  achievements: Array<{ id: number }>
): Record<number, any> => {
  const map: Record<number, any> = {};

  for (const achievement of achievements) {
    map[achievement.id] = achievement;
  }

  return map;
};
