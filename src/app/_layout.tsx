import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Providers } from '../shared/Providers';
import { colors } from '../shared/ui';

export default function RootLayout() {
  return (
    <Providers>
      <StatusBar style="dark" />
      {/* The hub is the home screen; each module brings its own tabs and headers. */}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="quick" options={{ headerShown: true, title: '⚡ Quick actions', headerStyle: { backgroundColor: colors.bg }, headerShadowVisible: false }} />
      </Stack>
    </Providers>
  );
}
