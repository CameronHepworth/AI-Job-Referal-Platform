import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { userService } from './api';

// Controls how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request permission and register the device push token with the backend.
 * Safe to call on every login — backend deduplicates.
 */
export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    // Push notifications don't work in simulators
    console.log('[notifications] Skipping push registration — not a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[notifications] Push permission denied');
    return null;
  }

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Hiring Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4f46e5',
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const pushToken = tokenData.data;

  // Save to backend so the signal engine can use it
  try {
    await userService.savePushToken(pushToken);
    console.log('[notifications] Push token registered:', pushToken);
  } catch (err) {
    console.error('[notifications] Failed to save push token:', err.message);
  }

  return pushToken;
}

/**
 * Set up listeners for notification interactions.
 * Returns a cleanup function — call it on unmount.
 */
export function setupNotificationListeners(onNotificationTap) {
  // Fired when user taps a notification
  const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (onNotificationTap && data?.companyId) {
      onNotificationTap(data.companyId);
    }
  });

  return () => {
    tapSub.remove();
  };
}
