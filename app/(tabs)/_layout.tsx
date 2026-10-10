/** Bottom tab bar: Home, Log, Progress, Learn, Profile — themed, amber active. */
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';
import { TabBar } from '@/components/TabBar';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function icon(name: IoniconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} size={size} color={color} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="log" options={{ title: 'Log', tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: icon('stats-chart') }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn', tabBarIcon: icon('book') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person') }} />
    </Tabs>
  );
}
