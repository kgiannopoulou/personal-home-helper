import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import type { HouseholdInfo, MemberInfo } from '../../shared/sync/api';
import { useSync } from '../../shared/sync/SyncProvider';
import { Button, Card, colors, Field, Muted, styles, Title } from '../../shared/ui';

const message = (e: unknown) => (e as { errors?: Record<string, string[]>; message?: string }).errors?.email?.[0] ?? (e as Error).message;

function Members() {
  const { account, members } = useSync();
  const [list, setList] = useState<MemberInfo[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    members().then(setList, (e) => setError(message(e)));
  }, [members, account?.household?.id]);

  return (
    <Card>
      <Title>👥 Members</Title>
      {!list && !error && <ActivityIndicator color={colors.primary} />}
      {!!error && <Muted>{error}</Muted>}
      {list?.map((m) => (
        <View key={m.id} style={[styles.progressHeader, { paddingVertical: 6 }]}>
          <Text style={styles.text}>
            {m.name}
            {m.id === account?.user.id ? ' (you)' : ''}
          </Text>
          <Muted>{m.role === 'owner' ? 'owner' : 'member'}</Muted>
        </View>
      ))}
    </Card>
  );
}

function Invite() {
  const { invite } = useSync();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<{ busy?: boolean; done?: string; error?: string }>({});

  return (
    <Card>
      <Title>✉️ Invite someone</Title>
      <Muted>They get an email with a link that works for 7 days. They sign in on their phone with that email address, then paste the link here under “Join a household”.</Muted>
      <View style={{ height: 10 }} />
      <Field label="Their email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
      {!!state.error && <Text style={[styles.text, { color: colors.danger, marginBottom: 8 }]}>{state.error}</Text>}
      {!!state.done && <Text style={[styles.text, { color: colors.primary, marginBottom: 8 }]}>{state.done}</Text>}
      <Button
        label={state.busy ? 'Sending…' : 'Send invite'}
        disabled={state.busy || !email.includes('@')}
        onPress={async () => {
          setState({ busy: true });
          try {
            await invite(email);
            setState({ done: `Invite sent to ${email.trim()}.` });
            setEmail('');
          } catch (e) {
            setState({ error: message(e) });
          }
        }}
      />
    </Card>
  );
}

function Join() {
  const { join } = useSync();
  const [link, setLink] = useState('');
  const [state, setState] = useState<{ busy?: boolean; error?: string }>({});

  return (
    <Card>
      <Title>🔗 Join a household</Title>
      <Muted>Paste the link from your invite email.</Muted>
      <View style={{ height: 10 }} />
      <Field label="Invite link" value={link} onChangeText={setLink} autoCapitalize="none" autoCorrect={false} placeholder="https://…/api/invites/…" />
      {!!state.error && <Text style={[styles.text, { color: colors.danger, marginBottom: 8 }]}>{state.error}</Text>}
      <Button
        label={state.busy ? 'Joining…' : 'Join'}
        disabled={state.busy || !link.trim()}
        onPress={async () => {
          setState({ busy: true });
          try {
            await join(link);
            setLink('');
            setState({});
          } catch (e) {
            setState({ error: message(e) });
          }
        }}
      />
    </Card>
  );
}

function Choose() {
  const { account, households, chooseHousehold, createHousehold } = useSync();
  const [list, setList] = useState<HouseholdInfo[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => households().then(setList, (e) => setError(message(e))), [households]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <Title>🏠 Your households</Title>
      {!list && !error && <ActivityIndicator color={colors.primary} />}
      {!!error && <Muted>{error}</Muted>}
      {list?.map((h) => (
        <Pressable
          key={h.id}
          accessibilityRole="button"
          onPress={() => chooseHousehold(h)}
          style={[styles.progressHeader, { paddingVertical: 8, alignItems: 'center' }]}
        >
          <Text style={[styles.text, { fontWeight: h.id === account?.household?.id ? '800' : '400' }]}>
            {h.id === account?.household?.id ? '✓ ' : ''}
            {h.name}
          </Text>
          <Muted>{h.role}</Muted>
        </Pressable>
      ))}
      <Muted>Switching shares everything on this phone with the household you pick.</Muted>
      <View style={{ height: 12 }} />
      <Field label="Or start a new one" value={name} onChangeText={setName} placeholder="e.g. Patission 12" />
      <Button label="Create household" variant="secondary" disabled={!name.trim()} onPress={() => createHousehold(name.trim()).then(() => setName(''), (e) => setError(message(e)))} />
    </Card>
  );
}

export default function HouseholdScreen() {
  const { account } = useSync();
  if (!account) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Muted>Sign in first, in Account & sync.</Muted>
      </View>
    );
  }
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {account.household && <Members />}
      {account.household?.role === 'owner' && <Invite />}
      <Join />
      <Choose />
    </ScrollView>
  );
}
