import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { Button, Card, Chip, colors, Field, Muted, Progress, styles, Title } from '../../shared/ui';
import { CATEGORY_LABEL, shoppingText } from '../../shared/homeCore';
import { estimateList, estimatePrice, groupByCategory, money, parseItems, quickAdds, spendSummary } from '../../modules/shopping/lib/shopping';
import { useStore } from '../../modules/shopping/lib/store';
import type { ListItem } from '../../modules/shopping/lib/types';

export default function ShoppingList() {
  const { state, ready, addItems, toggle } = useStore();
  const [text, setText] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const c = state.settings.currency;

  const view = useMemo(() => {
    const estimate = estimateList(state.items, state.prices);
    const spent = spendSummary(state.trips).thisWeek;
    return { groups: groupByCategory(state.items), estimate, spent, quick: quickAdds(state.history, state.items) };
  }, [state]);

  if (!ready) return null;

  const add = () => {
    const items = parseItems(text);
    if (items.length) addItems(items);
    setText('');
  };
  const checked = state.items.filter((i) => i.checked).length;
  const budget = state.settings.weeklyBudget;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <View style={[styles.row, { alignItems: 'center' }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={add}
            placeholder="Add items: milk, 2 x eggs, dish soap"
            placeholderTextColor={colors.muted}
            returnKeyType="done"
            style={[styles.input, { flex: 1 }]}
          />
          <Button label="Add" onPress={add} disabled={!text.trim()} />
        </View>
        {view.quick.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Muted>You often buy:</Muted>
            <View style={[styles.row, { marginTop: 6 }]}>
              {view.quick.map((name) => (
                <Chip key={name} label={`+ ${name}`} onPress={() => addItems([{ name }])} />
              ))}
            </View>
          </View>
        )}
      </Card>

      {budget > 0 && (
        <Card>
          <Progress
            label={`This trip ≈ ${money(view.estimate.total, c)}${view.estimate.unknown ? ` (+${view.estimate.unknown} unpriced)` : ''}`}
            value={view.spent + view.estimate.total}
            target={budget}
            unit={`${c.trim()} this week`}
          />
          <Muted>
            {view.spent > 0 ? `Includes ${money(view.spent, c)} already spent this week. ` : ''}
            {view.spent + view.estimate.total > budget
              ? `This list would take you ${money(view.spent + view.estimate.total - budget, c)} over.`
              : `${money(budget - view.spent - view.estimate.total, c)} to spare after this list.`}
          </Muted>
        </Card>
      )}

      {state.items.length === 0 && (
        <Card>
          <Title>Your list is empty 🎉</Title>
          <Muted>Add items above, or send them from Kitchen Inventory when something runs low. Items are sorted into Food, Cleaning, Bathroom, Home and Pet automatically.</Muted>
        </Card>
      )}

      {view.groups.map((g) => (
        <Card key={g.category}>
          <Title>{CATEGORY_LABEL[g.category]}</Title>
          {g.items.map((item) =>
            openId === item.id ? (
              <EditItem key={item.id} item={item} onClose={() => setOpenId(null)} />
            ) : (
              <Row key={item.id} item={item} currency={c} onToggle={() => toggle(item.id)} onOpen={() => setOpenId(item.id)} />
            ),
          )}
        </Card>
      ))}

      {state.items.length > 0 && (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Button
              label={checked ? `✅ Finish shopping (${checked})` : 'Tick items as you shop'}
              disabled={checked === 0}
              onPress={() => setFinishing(true)}
            />
          </View>
          <Button variant="secondary" label="Share" onPress={() => Share.share({ message: shoppingText(state.items.filter((i) => !i.checked)) })} />
        </View>
      )}
      {finishing && <FinishTrip onDone={() => setFinishing(false)} />}
    </ScrollView>
  );
}

function Row({ item, currency, onToggle, onOpen }: { item: ListItem; currency: string; onToggle: () => void; onOpen: () => void }) {
  const { state } = useStore();
  const price = estimatePrice(item, state.prices);
  return (
    <View style={styles.listItem}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.checked }}
        accessibilityLabel={item.name}
        onPress={onToggle}
        hitSlop={8}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
      >
        <Text style={{ fontSize: 20 }}>{item.checked ? '✅' : '⬜'}</Text>
        <Text style={[styles.text, item.checked && { textDecorationLine: 'line-through', color: colors.muted }]}>
          {item.quantity ? `${item.quantity} ` : ''}
          {item.name}
          {item.source === 'inventory' ? ' 🏠' : ''}
        </Text>
      </Pressable>
      <Pressable onPress={onOpen} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Edit ${item.name}`}>
        <Muted>{price !== undefined ? `${item.price === undefined ? '~' : ''}${money(price, currency)}` : 'edit'}</Muted>
      </Pressable>
    </View>
  );
}

function EditItem({ item, onClose }: { item: ListItem; onClose: () => void }) {
  const { state, updateItem, removeItem } = useStore();
  const [quantity, setQuantity] = useState(item.quantity ?? '');
  const est = estimatePrice({ name: item.name, price: undefined }, state.prices);
  const [price, setPrice] = useState(item.price !== undefined ? String(item.price) : '');
  const p = Number(price.replace(',', '.'));

  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={[styles.text, { fontWeight: '700', marginBottom: 8 }]}>{item.name}</Text>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field label="Quantity" value={quantity} onChangeText={setQuantity} />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Price"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder={est !== undefined ? `~${est.toFixed(2)}` : ''}
          />
        </View>
      </View>
      <View style={styles.row}>
        <Button
          label="Save"
          disabled={price !== '' && !(p >= 0)}
          onPress={() => {
            updateItem(item.id, { quantity: quantity.trim() || undefined, price: price === '' ? undefined : p });
            onClose();
          }}
        />
        <Button variant="secondary" label="Cancel" onPress={onClose} />
        <Button variant="danger" label="Remove" onPress={() => removeItem(item.id)} />
      </View>
    </View>
  );
}

function FinishTrip({ onDone }: { onDone: () => void }) {
  const { state, finishTrip } = useStore();
  const checkedItems = state.items.filter((i) => i.checked);
  const suggested = checkedItems.reduce((s, i) => s + (estimatePrice(i, state.prices) ?? 0), 0);
  const [total, setTotal] = useState(suggested ? suggested.toFixed(2) : '');
  const [store, setStore] = useState('');
  const t = Number(total.replace(',', '.'));

  return (
    <Card style={{ borderColor: colors.primary }}>
      <Title>Finish shopping</Title>
      <Muted>
        {checkedItems.length} item(s) bought. Enter what you actually paid to track your spending (or leave empty to skip).
      </Muted>
      <View style={{ height: 8 }} />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field label={`Total (${state.settings.currency})`} value={total} onChangeText={setTotal} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Store (optional)" value={store} onChangeText={setStore} placeholder="e.g. Lidl" />
        </View>
      </View>
      <View style={styles.row}>
        <Button
          label="Done"
          disabled={total !== '' && !(t >= 0)}
          onPress={() => {
            finishTrip(total === '' ? 0 : Math.round(t * 100) / 100, store.trim() || undefined);
            onDone();
          }}
        />
        <Button variant="secondary" label="Cancel" onPress={onDone} />
      </View>
    </Card>
  );
}
