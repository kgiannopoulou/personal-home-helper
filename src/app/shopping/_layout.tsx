import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { HomeButton } from '../../shared/HomeButton';
import { colors } from '../../shared/ui';

const icon = (emoji: string) => () => <Text style={{ fontSize: 20 }}>{emoji}</Text>;

export default function ShoppingLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerLeft: () => <HomeButton />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Shopping list', tabBarIcon: icon('🛒') }} />
      <Tabs.Screen name="spending" options={{ title: 'Spending', tabBarIcon: icon('💶') }} />
      <Tabs.Screen name="settings" options={{ title: 'Budget', tabBarIcon: icon('⚙️') }} />
      {/* Opened by the Kitchen and Chores modules to import items and receipts */}
      <Tabs.Screen name="add" options={{ href: null, title: 'Import' }} />
    </Tabs>
  );
}
