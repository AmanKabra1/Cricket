import * as Haptics from "expo-haptics";

/** Fire-and-forget tactile feedback. Wrapped so a missing module / web never throws. */
export const tap = () => {
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
};
export const success = () => {
  try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
};
export const warn = () => {
  try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
};
