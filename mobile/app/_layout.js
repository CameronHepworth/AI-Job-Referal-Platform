import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { PurchaseProvider } from '../context/PurchaseContext';
import { registerForPushNotifications, setupNotificationListeners } from '../services/notifications';

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const notifCleanup = useRef(null);
  // Auth guard — re-reads onboarding flag on every navigation so it stays fresh
  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';
    const inResetPassword = segments[0] === 'reset-password';

    // These screens are accessible regardless of auth state
    if (inResetPassword) return;

    AsyncStorage.getItem('onboarding_complete').then((val) => {
      const onboardingDone = val === 'true';
      if (!onboardingDone && !inOnboarding) {
        router.replace('/onboarding');
      } else if (!user && !inAuthGroup && !inOnboarding) {
        router.replace('/(auth)/login');
      } else if (user && inAuthGroup) {
        router.replace('/(tabs)');
      }
    });
  }, [user, loading, segments]);

  // Register push notifications when user logs in
  useEffect(() => {
    if (!user) return;

    registerForPushNotifications();

    // Handle notification taps — navigate to company detail
    notifCleanup.current = setupNotificationListeners((companyId) => {
      router.push(`/company/${companyId}`);
    });

    return () => {
      if (notifCleanup.current) notifCleanup.current();
    };
  }, [user]);

  return (
    <Stack>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="search" options={{ title: 'Search Companies', headerBackTitle: 'Back' }} />
      <Stack.Screen name="company/[id]" options={{ title: 'Company', headerBackTitle: 'Back' }} />
      <Stack.Screen name="paywall" options={{ title: 'Upgrade to Pro', presentation: 'modal' }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <PurchaseProvider>
        <RootLayoutNav />
      </PurchaseProvider>
    </AuthProvider>
  );
}
