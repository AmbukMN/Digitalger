import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/lib/auth';
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
  useEffect(() => {
    /* ⚠️ Дэлгэцийн эргэлтийг ЗӨВХӨН плеер дээр зөвшөөрнө — бусад
       дэлгэц босоо. Тохиргоог `app.json`-д `default` болгосон тул
       энд удирдана. */
  }, []);

  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <SafeAreaProvider>
          {/* ⚠️ Апп харанхуй тул статус мөр ЦАГААН бичигтэй.
              `backgroundColor` нь expo-status-bar 57-д хасагдсан —
              өнгийг `contentStyle`-аас авна. */}
          <StatusBar style="light" />
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
            <Stack.Screen name="login" options={{ title: 'Нэвтрэх' }} />
            <Stack.Screen name="register" options={{ title: 'Бүртгүүлэх' }} />
          </Stack>
        </SafeAreaProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
