import { Stack } from 'expo-router';
import { HomeButton } from '../../shared/HomeButton';
import { colors } from '../../shared/ui';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerShadowVisible: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" options={{ title: '⚙️ Account & sync', headerLeft: () => <HomeButton /> }} />
      <Stack.Screen name="household" options={{ title: '🏠 Household' }} />
    </Stack>
  );
}
