import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { HomeButton } from '../../shared/HomeButton';
import { colors } from '../../shared/ui';

const icon = (emoji: string) => () => <Text style={{ fontSize: 20 }}>{emoji}</Text>;

export default function ChoresLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerLeft: () => <HomeButton />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('✅') }} />
      <Tabs.Screen name="clean" options={{ title: 'Clean', tabBarIcon: icon('🧼') }} />
      <Tabs.Screen name="rooms" options={{ title: 'Rooms', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="supplies" options={{ title: 'Supplies', tabBarIcon: icon('🧽') }} />
      <Tabs.Screen name="household" options={{ title: 'Household', tabBarIcon: icon('👥') }} />
    </Tabs>
  );
}
