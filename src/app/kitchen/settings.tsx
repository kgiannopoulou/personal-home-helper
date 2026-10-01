import { useEffect, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { Button, Card, Field, Muted, styles, Title } from '../../shared/ui';
import { remindersSupported } from '../../modules/kitchen/lib/reminders';
import { getApiKey, setApiKey } from '../../modules/kitchen/lib/storage';
import { useStore } from '../../modules/kitchen/lib/store';

export default function Settings() {
  const { state, setSettings } = useStore();
  const s = state.settings;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Title>Automation</Title>
        <View style={styles.listItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.text}>Auto-add to shopping</Text>
            <Muted>When something is marked low or finished, put it on the to-buy list.</Muted>
          </View>
          <Switch value={s.autoAddLow} onValueChange={(autoAddLow) => setSettings({ ...s, autoAddLow })} />
        </View>
        <View style={[styles.listItem, { borderBottomWidth: 0 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.text}>Expiry reminders</Text>
            <Muted>
              {remindersSupported
                ? 'A notification at 09:00 the day before food expires, with a recipe idea.'
                : 'Notifications only work in the phone app.'}
            </Muted>
          </View>
          <Switch value={s.expiryReminders} onValueChange={(expiryReminders) => setSettings({ ...s, expiryReminders })} />
        </View>
      </Card>
      <ApiKeyCard />
    </ScrollView>
  );
}

function ApiKeyCard() {
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [status, setStatus] = useState('');
  useEffect(() => {
    getApiKey().then((k) => setHasKey(!!k));
  }, []);

  return (
    <Card>
      <Title>AI receipt scanning</Title>
      <Muted>
        Receipt scanning uses Claude. Paste your own Anthropic API key (console.anthropic.com). It's stored only on this
        device{hasKey ? ', and one is saved now' : ''}.
      </Muted>
      <View style={{ height: 8 }} />
      <Field label="Anthropic API key" value={key} onChangeText={setKey} placeholder={hasKey ? '•••••• (saved)' : 'sk-ant-…'} secureTextEntry autoCapitalize="none" />
      <View style={styles.row}>
        <Button
          label="Save key"
          disabled={!key.trim()}
          onPress={async () => {
            await setApiKey(key.trim());
            setKey('');
            setHasKey(true);
            setStatus('Key saved ✓');
          }}
        />
        {hasKey && (
          <Button
            variant="secondary"
            label="Remove key"
            onPress={async () => {
              await setApiKey('');
              setHasKey(false);
              setStatus('Key removed');
            }}
          />
        )}
      </View>
      {!!status && <Muted>{status}</Muted>}
    </Card>
  );
}
