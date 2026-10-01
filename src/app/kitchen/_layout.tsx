import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { HomeButton } from '../../shared/HomeButton';
import { colors } from '../../shared/ui';

const icon = (emoji: string) => () => <Text style={{ fontSize: 20 }}>{emoji}</Text>;

export default function KitchenLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerLeft: () => <HomeButton />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Kitchen', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="items" options={{ title: 'Inventory', tabBarIcon: icon('📦') }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan receipt', tabBarIcon: icon('🧾') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('⚙️') }} />
    </Tabs>
  );
}
