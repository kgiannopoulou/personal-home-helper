import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, Chip, colors, Field, Muted, styles, Title } from '../../shared/ui';
import { LEVEL_LABEL, LEVELS, needsBuying, parseSupplyUpdate } from '../../modules/chores/lib/chores';
import { CATEGORIES, CATEGORY_LABEL } from '../../shared/homeCore';
import { sendToShopping } from '../../modules/chores/lib/sendToShopping';
import { useStore } from '../../modules/chores/lib/store';

export default function Supplies() {
  const { state, setSupplyLevel, removeSupply } = useStore();
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const parsed = parseSupplyUpdate(text);
  const toBuy = state.supplies.filter(needsBuying);

  const flash = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Title>Tell me what you used</Title>
        <Field
          label="e.g. “I finished the dish soap” or “sponges are low”"
          value={text}
          onChangeText={setText}
          placeholder="I finished the dish soap"
          returnKeyType="done"
        />
        {text.trim() !== '' && !parsed && (
          <Muted>Try “I finished …”, “out of …”, “… is low” or “bought …”, or add an item below.</Muted>
        )}
        <Button
          label={parsed ? `${parsed.name} → ${LEVEL_LABEL[parsed.level]}` : 'Update'}
          disabled={!parsed}
          onPress={() => {
            if (!parsed) return;
            setSupplyLevel(parsed.name, parsed.level);
            setText('');
            flash(needsBuying({ ...parsed, id: '', category: 'other' }) ? `${parsed.name} added to “Running low”.` : `${parsed.name} updated.`);
          }}
        />
        {!!message && <Text style={{ color: colors.primary, marginTop: 8 }}>{message}</Text>}
      </Card>

      {toBuy.length > 0 && (
        <Card style={{ backgroundColor: colors.warnSoft }}>
          <Title>🛒 Running low</Title>
          <Text style={styles.text}>{toBuy.map((s) => s.name).join(', ')}</Text>
          <View style={{ height: 10 }} />
          <Button
            label={`Add ${toBuy.length} to shopping list`}
            onPress={async () => {
              const via = await sendToShopping(toBuy.map((s) => s.name));
              flash(via === 'app' ? 'Sent to Smart Shopping List.' : 'Shared as a list.');
            }}
          />
          <Muted>Opens Smart Shopping List. Mark items 🟢 Full once you've bought them.</Muted>
        </Card>
      )}

      {CATEGORIES.map((c) => {
        const items = state.supplies.filter((s) => s.category === c).sort((a, b) => a.name.localeCompare(b.name));
        if (!items.length) return null;
        return (
          <Card key={c}>
            <Title>{CATEGORY_LABEL[c]}</Title>
            {items.map((s) => (
              <View key={s.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <View style={styles.progressHeader}>
                  <Text style={styles.text}>{s.name}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${s.name}`} onPress={() => removeSupply(s.id)} hitSlop={8}>
                    <Text style={{ color: colors.muted }}>✕</Text>
                  </Pressable>
                </View>
                <View style={[styles.row, { marginTop: 6 }]}>
                  {LEVELS.map((l) => (
                    <Chip key={l} label={LEVEL_LABEL[l]} selected={s.level === l} onPress={() => setSupplyLevel(s.name, l)} />
                  ))}
                </View>
              </View>
            ))}
          </Card>
        );
      })}

      <AddSupply />
    </ScrollView>
  );
}

function AddSupply() {
  const { setSupplyLevel } = useStore();
  const [name, setName] = useState('');
  return (
    <Card>
      <Title>Add a supply</Title>
      <View style={[styles.row, { alignItems: 'flex-end' }]}>
        <View style={{ flex: 1 }}>
          <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Glass cleaner" />
        </View>
        <View style={{ marginBottom: 12 }}>
          <Button
            label="Add"
            variant="secondary"
            disabled={!name.trim()}
            onPress={() => {
              setSupplyLevel(name.trim(), 'full');
              setName('');
            }}
          />
        </View>
      </View>
      <Muted>It's sorted into cleaning, bathroom, home or pet automatically.</Muted>
    </Card>
  );
}
