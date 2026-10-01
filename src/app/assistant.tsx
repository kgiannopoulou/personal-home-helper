import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useAssistantActions } from '../modules/assistant/lib/actions';
import { ask, AssistantError } from '../modules/assistant/lib/assistant';
import { bubble, loadChat, newChat, saveChat, SUGGESTIONS, type Chat } from '../modules/assistant/lib/chat';
import { todayContext } from '../modules/assistant/lib/context';
import { makeTools, type ActionLog } from '../modules/assistant/lib/tools';
import { getApiKey, setApiKey } from '../modules/kitchen/lib/storage';
import { Button, Card, Chip, colors, Field, Muted, styles, Title } from '../shared/ui';
import { useHub } from '../shared/useHub';

function KeySetup({ onSaved }: { onSaved: () => void }) {
  const [key, setKey] = useState('');
  return (
    <Card>
      <Title>🧠 Set up the assistant</Title>
      <Muted>
        The assistant uses Claude. Paste your own Anthropic API key (console.anthropic.com). It's stored only on this device and
        is also used for meal photos, receipts and gift ideas.
      </Muted>
      <View style={{ height: 8 }} />
      <Field label="Anthropic API key" value={key} onChangeText={setKey} placeholder="sk-ant-…" secureTextEntry autoCapitalize="none" />
      <Button
        label="Save key"
        disabled={!key.trim()}
        onPress={async () => {
          await setApiKey(key.trim());
          onSaved();
        }}
      />
    </Card>
  );
}

export default function Assistant() {
  const hub = useHub();
  const actions = useAssistantActions();
  const [chat, setChat] = useState<Chat | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const chatRef = useRef<Chat | null>(null);
  chatRef.current = chat;

  useEffect(() => {
    loadChat().then(setChat);
    getApiKey().then((k) => setHasKey(!!k));
    return () => {
      Speech.stop();
    };
  }, []);

  const update = (next: Chat) => {
    chatRef.current = next;
    setChat(next);
    saveChat(next).catch((e) => console.warn('Could not save chat', e));
  };

  const send = async (question: string) => {
    const current = chatRef.current;
    const q = question.trim();
    if (!q || !current || busy) return;
    setText('');
    setBusy(true);
    const withQuestion = { ...current, bubbles: [...current.bubbles, bubble('user', q)] };
    update(withQuestion);
    const done: ActionLog[] = [];
    try {
      const key = await getApiKey();
      if (!key) throw new AssistantError('Add your Anthropic API key first.');
      const { history, reply } = await ask(key, current.history, todayContext(hub), q, makeTools(actions, (a) => done.push(a)));
      update({ ...withQuestion, history, bubbles: [...withQuestion.bubbles, bubble('assistant', reply, { actions: done.map((a) => a.result) })] });
      if (withQuestion.speak && Platform.OS !== 'web') Speech.speak(reply);
    } catch (e) {
      const message = e instanceof AssistantError ? e.message : 'Something went wrong. Please try again.';
      // Anything already done in the app is still listed, even if the reply failed.
      update({ ...withQuestion, bubbles: [...withQuestion.bubbles, bubble('assistant', message, { error: true, actions: done.map((a) => a.result) })] });
    } finally {
      setBusy(false);
    }
  };

  if (!chat || hasKey === null) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;
  if (!hasKey) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <KeySetup onSaved={() => setHasKey(true)} />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {chat.bubbles.length === 0 && (
          <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
            <Title>Hi! I can see your whole day 👋</Title>
            <Muted>
              Your calendar, food, kitchen, shopping, money, chores and weather. Ask me to plan, or tell me what happened and I'll
              update the app.
            </Muted>
          </Card>
        )}
        {chat.bubbles.map((b) => (
          <View key={b.id} style={{ alignItems: b.role === 'user' ? 'flex-end' : 'flex-start', gap: 4 }}>
            <View
              style={{
                maxWidth: '88%',
                padding: 12,
                borderRadius: 16,
                backgroundColor: b.role === 'user' ? colors.primary : b.error ? colors.warnSoft : colors.card,
                borderWidth: b.role === 'user' ? 0 : 1,
                borderColor: colors.border,
              }}
            >
              <Text style={[styles.text, b.role === 'user' && { color: '#fff' }]} selectable>
                {b.text}
              </Text>
            </View>
            {b.actions?.map((a) => (
              <Text key={a} style={{ fontSize: 13, color: colors.primary, maxWidth: '88%' }}>
                ✓ {a}
              </Text>
            ))}
          </View>
        ))}
        {busy && (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} />
            <Muted>Looking at your day…</Muted>
          </View>
        )}
        {!busy && (
          <View style={styles.row}>
            {SUGGESTIONS.map((s) => (
              <Chip key={s} label={s} onPress={() => send(s)} />
            ))}
          </View>
        )}
      </ScrollView>

      <View style={{ padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Ask or tell me anything… (🎤 use your keyboard's mic)"
            placeholderTextColor={colors.muted}
            multiline
            style={[styles.input, { flex: 1, maxHeight: 120 }]}
            onSubmitEditing={() => send(text)}
            blurOnSubmit
            returnKeyType="send"
            accessibilityLabel="Message"
          />
          <Button label="Send" disabled={!text.trim() || busy} onPress={() => send(text)} />
        </View>
        <View style={[styles.progressHeader, { alignItems: 'center' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Switch value={chat.speak} onValueChange={(speak) => update({ ...chat, speak })} accessibilityLabel="Read replies aloud" />
            <Muted>🔊 Read replies aloud</Muted>
          </View>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Pressable accessibilityRole="button" onPress={() => setHasKey(false)} disabled={busy} hitSlop={8}>
              <Text style={{ color: colors.muted }}>Change key</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => update(newChat(chat.speak))} disabled={busy} hitSlop={8}>
              <Text style={{ color: colors.primary }}>New chat</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
