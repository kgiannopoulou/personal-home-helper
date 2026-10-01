import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, ChipRow, colors, Field, Muted, styles, Title } from '../../shared/ui';
import { toDateKey } from '../../shared/dates';
import { CATEGORY_LABEL, categorize } from '../../shared/homeCore';
import { expiryStatus, guessLocation, predictRunOut } from '../../modules/kitchen/lib/inventory';
import { useStore } from '../../modules/kitchen/lib/store';
import type { InventoryItem, Level, Location } from '../../modules/kitchen/lib/types';

const LOCATIONS: { value: Location; label: string }[] = [
  { value: 'fridge', label: '🧊 Fridge' },
  { value: 'freezer', label: '❄️ Freezer' },
  { value: 'pantry', label: '🥫 Pantry' },
  { value: 'bathroom', label: '🚿 Bathroom' },
  { value: 'cleaning', label: '🧽 Cleaning' },
  { value: 'other', label: '📦 Other' },
];

const LEVELS: { value: Level; label: string }[] = [
  { value: 'full', label: '🟢 Full' },
  { value: 'half', label: '🟡 Half' },
  { value: 'low', label: '🟠 Low' },
  { value: 'empty', label: '🔴 Empty' },
];

const LEVEL_DOT: Record<Level, string> = { full: '🟢', half: '🟡', low: '🟠', empty: '🔴' };

export default function Items() {
  const { state } = useStore();
  const [filter, setFilter] = useState<Location | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const items = useMemo(
    () =>
      state.items
        .filter((i) => filter === 'all' || i.location === filter)
        .sort((a, b) => (a.expiresAt ?? '9999').localeCompare(b.expiresAt ?? '9999') || a.name.localeCompare(b.name)),
    [state.items, filter],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <AddItem />
      <ChipRow value={filter} onChange={setFilter} options={[{ value: 'all', label: `All (${state.items.length})` }, ...LOCATIONS]} />
      <Card>
        {items.length === 0 && <Muted>Nothing here yet.</Muted>}
        {items.map((item) =>
          openId === item.id ? (
            <EditItem key={item.id} item={item} onClose={() => setOpenId(null)} />
          ) : (
            <ItemRow key={item.id} item={item} onPress={() => setOpenId(item.id)} />
          ),
        )}
      </Card>
    </ScrollView>
  );
}

function ItemRow({ item, onPress }: { item: InventoryItem; onPress: () => void }) {
  const { setLevel } = useStore();
  const exp = expiryStatus(item);
  const next: Record<Level, Level> = { full: 'half', half: 'low', low: 'empty', empty: 'full' };
  return (
    <View style={styles.listItem}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.name} is ${item.level}. Tap to change`}
        onPress={() => setLevel(item.id, next[item.level])}
        hitSlop={8}
      >
        <Text style={{ fontSize: 22 }}>{LEVEL_DOT[item.level]}</Text>
      </Pressable>
      <Pressable style={{ flex: 1 }} onPress={onPress}>
        <Text style={styles.text}>
          {item.name}
          {item.quantity ? ` · ${item.quantity}` : ''}
        </Text>
        <Muted>
          {exp
            ? exp.daysLeft < 0
              ? `⚠️ expired ${item.expiresAt}`
              : `expires ${item.expiresAt}${exp.daysLeft <= 2 ? ' ⚠️' : ''}`
            : CATEGORY_LABEL[item.category]}
        </Muted>
      </Pressable>
    </View>
  );
}

function EditItem({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const { updateItem, setLevel, removeItem, addToBuy } = useStore();
  const [expires, setExpires] = useState(item.expiresAt ?? '');
  const prediction = predictRunOut(item);
  const validDate = expires === '' || /^\d{4}-\d{2}-\d{2}$/.test(expires);

  return (
    <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 }}>
      <Text style={[styles.text, { fontWeight: '700' }]}>{item.name}</Text>
      <ChipRow value={item.level} onChange={(l) => setLevel(item.id, l)} options={LEVELS} />
      <ChipRow value={item.location} onChange={(location) => updateItem(item.id, { location })} options={LOCATIONS} />
      <Field label="Expires (YYYY-MM-DD, empty if it keeps)" value={expires} onChangeText={setExpires} autoCapitalize="none" />
      <Muted>
        Bought {item.boughtAt}
        {item.price ? ` · ${item.price.toFixed(2)}` : ''} · bought {item.purchases.length}×
        {prediction ? ` · usually every ${prediction.everyDays} days` : ''}
      </Muted>
      <View style={styles.row}>
        <Button
          label="Save"
          disabled={!validDate}
          onPress={() => {
            updateItem(item.id, { expiresAt: expires || undefined });
            onClose();
          }}
        />
        <Button variant="secondary" label="+ Shopping" onPress={() => addToBuy(item.name)} />
        <Button variant="secondary" label="Close" onPress={onClose} />
        <Button variant="danger" label="Delete" onPress={() => removeItem(item.id)} />
      </View>
    </View>
  );
}

function AddItem() {
  const { addItem } = useStore();
  const [name, setName] = useState('');
  const [location, setLocation] = useState<Location | null>(null);
  const [quantity, setQuantity] = useState('');
  const [msg, setMsg] = useState('');
  const guessed = name.trim() ? guessLocation(name, categorize(name)) : 'pantry';
  const where = location ?? guessed;

  return (
    <Card>
      <Title>Add or restock</Title>
      <Field label="Item" value={name} onChangeText={(v) => { setName(v); setLocation(null); }} placeholder="e.g. Milk, Spinach, Dish soap" />
      <Field label="Quantity (optional)" value={quantity} onChangeText={setQuantity} placeholder="e.g. 1 L, 6 pack" />
      <ChipRow value={where} onChange={setLocation} options={LOCATIONS} />
      <View style={{ height: 12 }} />
      <Button
        label="Add"
        disabled={!name.trim()}
        onPress={() => {
          addItem(name.trim(), { location: where, quantity: quantity.trim() || undefined });
          setMsg(`${name.trim()} added ✓ (bought ${toDateKey()})`);
          setName('');
          setQuantity('');
          setLocation(null);
        }}
      />
      {!!msg && <Muted>{msg}</Muted>}
    </Card>
  );
}
