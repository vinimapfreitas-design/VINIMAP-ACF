// Push Notifications and Web Worker Service Helper

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn("Notifications not supported in this browser.");
    return false;
  }
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.error("Error requesting notification permission:", err);
    return false;
  }
}

export function sendLocalNotification(title: string, options?: NotificationOptions): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }
  try {
    new Notification(title, {
      icon: '/icon.svg',
      badge: '/icon.svg',
      ...options
    });
  } catch (err) {
    console.warn("Could not display notification:", err);
  }
}

export async function registerPushNotifications(): Promise<string | null> {
  const granted = await requestNotificationPermission();
  if (granted) {
    return 'push_token_active';
  }
  return null;
}

export function onMessageReceived(callback: (payload: any) => void): () => void {
  return () => {};
}

