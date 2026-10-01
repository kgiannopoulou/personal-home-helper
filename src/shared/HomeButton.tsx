import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { colors } from './ui';

/** Back to the hub from any module. */
export function HomeButton() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to Home Helper"
      // Goes back to the hub if it's below in the stack, or opens it when a module was opened directly by a link.
      onPress={() => router.navigate('/')}
      hitSlop={10}
      style={{ paddingHorizontal: 14 }}
    >
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.primary }}>‹ Home</Text>
    </Pressable>
  );
}
