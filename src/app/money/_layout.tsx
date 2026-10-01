import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { HomeButton } from '../../shared/HomeButton';
import { colors } from '../../shared/ui';

const icon = (emoji: string) => () => <Text style={{ fontSize: 20 }}>{emoji}</Text>;

export default function MoneyLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerLeft: () => <HomeButton />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Overview', tabBarIcon: icon('💶') }} />
      <Tabs.Screen name="expenses" options={{ title: 'Expenses', tabBarIcon: icon('🧾') }} />
      <Tabs.Screen name="energy" options={{ title: 'Energy', tabBarIcon: icon('🔌') }} />
      <Tabs.Screen name="settings" options={{ title: 'Budget', tabBarIcon: icon('⚙️') }} />
      {/* Also reachable from outside: homehelper://money/add?spend=… */}
      <Tabs.Screen name="add" options={{ href: null, title: 'Import' }} />
    </Tabs>
  );
}
