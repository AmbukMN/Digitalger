import { useEffect } from 'react';
import { OfflineBanner } from '../src/components/offline-banner';
import { ErrorBoundary } from '../src/components/error-boundary';
import { Stack, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/lib/auth';
import { UpdateGate } from '../src/components/update-gate';
import { colors } from '../src/theme';

/**
 * ⚠️ `QueryClient` нь модулийн түвшинд — компонент дотор үүсгэвэл
 * дахин render бүрд ШИНЭ клиент үүсэж кэш алга болно.
 */
const qc = new QueryClient({
  defaultOptions: {
    queries: {
      /* ⚠️ Мобайл сүлжээ тасалддаг — 2 удаа дахин оролдоно */
      retry: 2,
      /* ⚠️ Апп дэвсгэрээс буцахад дахин татна (вэбийн focus-тэй ижил) */
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

export default function RootLayout() {
  /**
   * ⚠️⚠️ МЭДЭГДЭЛ ДАРАХАД зөв хуудас руу очно.
   *
   * Backend нь `data.link` талбарт зам явуулдаг (`/title/slug`,
   * `/profile?tab=orders`). Үүнийг барихгүй бол хэрэглэгч мэдэгдэл дараад
   * зүгээр нүүр хуудсанд ирж, юуны тухай байсныг олохгүй.
   */
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      const link = res.notification.request.content.data?.link;
      if (typeof link === 'string' && link.startsWith('/')) {
        /* ⚠️ `push` — буцах товч ажиллана (`replace` бол түүх алдагдана) */
        router.push(link as never);
      }
    });
    return () => sub.remove();
  }, []);

  return (
    /* ⚠️⚠️ ХАМГИЙН ГАДНА — Provider өөрөө унасан ч барих ёстой.
       Үүнгүйгээр ямар ч render алдаа БҮХ АППЫГ хар дэлгэц болгоно */
    <ErrorBoundary>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <SafeAreaProvider>
            {/* ⚠️ Апп харанхуй тул статус мөр ЦАГААН бичигтэй.
                `backgroundColor` нь expo-status-bar 57-д хасагдсан —
                өнгийг `contentStyle`-аас авна. */}
            <StatusBar style="light" />
            <UpdateGate>
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: colors.background },
                  headerTintColor: colors.foreground,
                  headerTitleStyle: { fontWeight: '600' },
                  contentStyle: { backgroundColor: colors.background },
                  /* Буцах товчны текстийг монголоор */
                  headerBackTitle: 'Буцах',
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="title/[slug]"
                  options={{ title: '', headerTransparent: true }}
                />
                <Stack.Screen
                  name="watch/[id]"
                  options={{ headerShown: false, orientation: 'default' }}
                />
                <Stack.Screen name="pricing" options={{ title: 'Багц авах' }} />
                <Stack.Screen name="notifications" options={{ title: 'Мэдэгдэл' }} />
                <Stack.Screen name="support" options={{ title: 'Тусламж' }} />
                <Stack.Screen name="wallet" options={{ title: 'Хэтэвч' }} />
                <Stack.Screen name="devices" options={{ title: 'Төхөөрөмж' }} />
                <Stack.Screen name="login" options={{ title: 'Нэвтрэх' }} />
                <Stack.Screen name="register" options={{ title: 'Бүртгүүлэх' }} />
                <Stack.Screen
                  name="forgot-password"
                  options={{ title: 'Нууц үг сэргээх' }}
                />
                <Stack.Screen name="account" options={{ title: 'Профайл засах' }} />
              </Stack>
            </UpdateGate>
          </SafeAreaProvider>
          </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
