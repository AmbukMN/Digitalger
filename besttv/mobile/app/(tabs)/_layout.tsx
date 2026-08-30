import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '../../src/theme';

/**
 * ⚠️ Дүрс нь `Ionicons` — өмнө нь `⌂ ▦ ♥` тэмдэгт ашиглаж байсан нь
 * төхөөрөмж бүр дээр ӨӨР харагдаж, зарим Android дээр огт гардаггүй
 * (фонтод байхгүй). Дэлгүүрийн чанарын үнэлгээнд ч нөлөөлнө.
 */
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/** ⚠️ Сонгосон үед дүүрэн, сонгоогүй үед контур — iOS-ийн жишиг */
function icon(base: string, focused: boolean): IoniconName {
  return (focused ? base : `${base}-outline`) as IoniconName;
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
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={icon('home', focused)} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: 'Кино',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={icon('film', focused)} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-list"
        options={{
          title: 'Дуртай',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={icon('heart', focused)} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Хайх',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={icon('search', focused)} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профайл',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={icon('person', focused)} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
