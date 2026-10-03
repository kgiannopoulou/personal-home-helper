import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { ApiError } from '../../shared/sync/api';
import { useSync } from '../../shared/sync/SyncProvider';
import { Button, Card, colors, Field, Muted, styles, Title } from '../../shared/ui';

function SignIn() {
  const { signIn } = useSync();
  const [server, setServer] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await signIn(server, email, password);
    } catch (e) {
      const err = e as ApiError;
      setError(err.errors?.email?.[0] ?? err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Title>Share with your household</Title>
      <Muted>
        Sign in to your Home Helper server to share the shopping list, kitchen, money, chores and planner with the people you live with. Food, water,
        sleep, workouts and weight stay yours: they sync to your other phones only.
      </Muted>
      <View style={{ height: 12 }} />
      <Field label="Server" value={server} onChangeText={setServer} placeholder="home.example.com" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" />
      {!!error && <Text style={[styles.text, { color: colors.danger, marginBottom: 8 }]}>{error}</Text>}
      {busy ? <ActivityIndicator color={colors.primary} /> : <Button label="Sign in" onPress={submit} disabled={!server.trim() || !email.trim() || !password} />}
    </Card>
  );
}

function since(iso?: string): string {
  if (!iso) return 'not yet';
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function AccountScreen() {
  const { account, loaded, status, syncNow, signOut } = useSync();
  const router = useRouter();

  if (!loaded) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!!status.error && !account && (
        <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
          <Text style={styles.text}>{status.error}</Text>
        </Card>
      )}
      {!account ? (
        <SignIn />
      ) : (
        <>
          <Card>
            <Title>👤 {account.user.name}</Title>
            <Muted>
              {account.user.email} · {account.serverUrl.replace(/^https?:\/\//, '')}
            </Muted>
          </Card>

          <Pressable accessibilityRole="button" onPress={() => router.push('/settings/household' as Href)} style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}>
            <View style={[styles.progressHeader, { alignItems: 'center' }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>🏠 {account.household?.name ?? 'Choose a household'}</Text>
                <Muted>{account.household ? 'Members, invite someone, or switch household' : 'Join one with an invite link, or start your own'}</Muted>
              </View>
              <Text style={{ fontSize: 20, color: colors.primary }}>›</Text>
            </View>
          </Pressable>

          {account.household && (
            <Card>
              <Title>🔄 Sync</Title>
              <Text style={styles.text}>{status.syncing ? 'Syncing…' : `Last synced ${since(status.lastSync)}`}</Text>
              {!!status.error && <Text style={[styles.text, { color: colors.danger }]}>{status.error}</Text>}
              {status.refused > 0 && <Muted>{status.refused} change(s) weren't accepted by the server and stay on this phone only.</Muted>}
              <Muted>Changes sync a few seconds after you make them, when the app opens, and when you come back to it.</Muted>
              <View style={{ height: 10 }} />
              <Button label="Sync now" variant="secondary" onPress={syncNow} disabled={status.syncing} />
            </Card>
          )}

          <Button label="Sign out" variant="danger" onPress={signOut} />
          <Muted>Signing out keeps everything on this phone; it just stops syncing.</Muted>
        </>
      )}
    </ScrollView>
  );
}
