import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { colors, font } from '../../src/theme';

/**
 * ⚠️ Дүрсийг сангаас БИШ, энгийн тэмдэгтээр гаргав — эхний хувилбарт
 * нэмэлт сан (lucide/vector-icons) татахгүй, bundle жижиг байлгана.
 * Дараа `@expo/vector-icons`-оор солино.
 */
function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 18, color: focused ? colors.primary : colors.faint }}>
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          /* ⚠️ iPhone-ы home indicator-т мөргөхгүйн тулд өндөр нэмнэ */
          height: 60,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontSize: font.xs, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Нүүр',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon label="⌂" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: 'Кино',
          tabBarIcon: ({ focused }) => <TabIcon label="▦" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="my-list"
        options={{
          title: 'Дуртай',
          tabBarIcon: ({ focused }) => <TabIcon label="♥" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Хайх',
          tabBarIcon: ({ focused }) => <TabIcon label="⌕" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профайл',
          tabBarIcon: ({ focused }) => <TabIcon label="☺" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
