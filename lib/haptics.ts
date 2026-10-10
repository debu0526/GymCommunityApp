/**
 * Central haptics helper. All components call these instead of expo-haptics directly,
 * so feedback stays consistent and future features inherit it automatically.
 * (Haptics are lightweight and always on; the user-facing toggle governs animations.)
 */
import * as Haptics from 'expo-haptics';

export const haptics = {
  /** light tick — taps, tab switches, selections */
  selection: () => { Haptics.selectionAsync().catch(() => {}); },
  /** firmer tap — long-press start */
  longPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); },
  /** completion — finished workout / exercise / new PR */
  success: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
  /** destructive — discard / delete */
  warning: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); },
};
