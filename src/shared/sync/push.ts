/**
 * Push notifications from the household's server (Phase 5 of home-helper-api): the shopping
 * list filled the evening before shopping day, budget alerts, the Sunday summary. They arrive
 * even when the app is closed, so they need an Expo push token, which needs:
 * - a development or store build (Expo Go can't receive remote pushes on Android since SDK 53),
 * - an EAS project id (`npx eas init` writes it to app.json under extra.eas.projectId),
 * - notification permission.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type PushState = { on: true; token: string } | { on: false; reason: string };

function projectId(): string | undefined {
  const fromConfig = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  return fromConfig ?? Constants.easConfig?.projectId;
}

/** Asks for permission if needed and returns this phone's Expo push token, or why there isn't one. */
export async function expoPushToken(): Promise<PushState> {
  if (Platform.OS === 'web') return { on: false, reason: 'Push notifications need the phone app.' };
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return { on: false, reason: 'Expo Go can’t receive pushes from the server. Use a development build (npx expo run:android).' };
  }
  const id = projectId();
  if (!id) return { on: false, reason: 'No EAS project id in app.json yet: run `npx eas init` and rebuild.' };

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Household', importance: Notifications.AndroidImportance.HIGH });
  }
  let { granted } = await Notifications.getPermissionsAsync();
  if (!granted) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return { on: false, reason: 'Notifications are turned off for Home Helper in the phone’s settings.' };

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId: id });
  return { on: true, token: data };
}
