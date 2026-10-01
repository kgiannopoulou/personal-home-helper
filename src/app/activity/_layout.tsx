import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { HomeButton } from '../../shared/HomeButton';
import { colors } from '../../shared/ui';

const icon = (emoji: string) => () => <Text style={{ fontSize: 20 }}>{emoji}</Text>;

export default function ActivityLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerLeft: () => <HomeButton />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="coach" options={{ title: 'Run coach', tabBarIcon: icon('🏃') }} />
      <Tabs.Screen name="log" options={{ title: 'Log', tabBarIcon: icon('📝') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: icon('📈') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('👤') }} />
    </Tabs>
  );
}
