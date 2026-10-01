import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, colors, Muted, styles, Title } from '../../shared/ui';
import { toDateKey } from '../../shared/dates';
import { CATEGORY_LABEL } from '../../shared/homeCore';
import { readReceipt, ReceiptAIError, type Receipt } from '../../modules/kitchen/lib/receiptAI';
import { sendToShopping } from '../../modules/kitchen/lib/sendToShopping';
import { getApiKey } from '../../modules/kitchen/lib/storage';
import { useStore } from '../../modules/kitchen/lib/store';

export default function Scan() {
  const { addReceipt } = useStore();
  const [photo, setPhoto] = useState<{ uri: string; base64: string; mimeType?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const [done, setDone] = useState('');

  const pick = async (source: 'camera' | 'library') => {
    setError('');
    setDone('');
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], base64: true, quality: 0.6 };
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setError('Camera permission is needed to photograph a receipt.');
    }
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = res.canceled ? null : res.assets[0];
    if (asset?.base64) {
      setPhoto({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType ?? undefined });
      setReceipt(null);
    }
  };

  const read = async () => {
    if (!photo) return;
    setError('');
    const key = await getApiKey();
    if (!key) return setError('Add your Anthropic API key in Settings to scan receipts.');
    setLoading(true);
    try {
      const mediaType = photo.mimeType === 'image/png' || photo.mimeType === 'image/webp' ? photo.mimeType : 'image/jpeg';
      const r = await readReceipt(key, photo.base64, mediaType);
      setReceipt(r);
      setSkip(new Set());
      if (r.items.length === 0) setError("Couldn't find any products on this image.");
    } catch (e) {
      setError(e instanceof ReceiptAIError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const save = async (alsoSpend: boolean) => {
    if (!receipt) return;
    const chosen = receipt.items.filter((_, i) => !skip.has(i));
    const n = addReceipt(chosen);
    let msg = `${n} item${n === 1 ? '' : 's'} added to your inventory ✓`;
    if (alsoSpend && receipt.total > 0) {
      const how = await sendToShopping({
        items: [],
        spend: receipt.total,
        store: receipt.store || undefined,
        date: /^\d{4}-\d{2}-\d{2}$/.test(receipt.date) ? receipt.date : toDateKey(),
      });
      msg += how === 'app' ? ' · spend sent to Smart Shopping List' : '';
    }
    setDone(msg);
    setReceipt(null);
    setPhoto(null);
  };

  const toggle = (i: number) =>
    setSkip((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Title>🧾 Scan a supermarket receipt</Title>
        <Muted>Take a photo and AI reads every product, where it's stored and how long it keeps, then updates your inventory.</Muted>
        <View style={[styles.row, { marginTop: 12 }]}>
          <Button variant="secondary" label="📷 Camera" onPress={() => pick('camera')} />
          <Button variant="secondary" label="🖼️ Gallery" onPress={() => pick('library')} />
        </View>
        {photo && <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 260, borderRadius: 12, marginTop: 12 }} resizeMode="contain" />}
        {photo && !receipt && (
          <View style={{ marginTop: 12 }}>
            <Button label={loading ? 'Reading…' : 'Read receipt'} onPress={read} disabled={loading} />
          </View>
        )}
        {loading && <ActivityIndicator style={{ marginTop: 12 }} color={colors.primary} />}
        {!!error && <Text style={{ color: colors.danger, marginTop: 8 }}>{error}</Text>}
        {!!done && <Text style={{ color: colors.primary, marginTop: 8, fontWeight: '600' }}>{done}</Text>}
      </Card>

      {receipt && receipt.items.length > 0 && (
        <Card>
          <Title>
            {receipt.store || 'Receipt'} · {receipt.currency} {receipt.total.toFixed(2)}
          </Title>
          <Muted>Tap an item to leave it out.</Muted>
          {receipt.items.map((item, i) => {
            const off = skip.has(i);
            return (
              <Pressable key={i} onPress={() => toggle(i)} style={[styles.listItem, off && { opacity: 0.4 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.text, off && { textDecorationLine: 'line-through' }]}>
                    {off ? '⬜' : '✅'} {item.name}
                    {item.quantity ? ` · ${item.quantity}` : ''}
                  </Text>
                  <Muted>
                    {CATEGORY_LABEL[item.category]} · {item.location}
                    {item.shelf_life_days > 0 ? ` · keeps ~${item.shelf_life_days} days` : ''}
                  </Muted>
                </View>
                <Text style={styles.text}>{item.price.toFixed(2)}</Text>
              </Pressable>
            );
          })}
          <View style={[styles.row, { marginTop: 12 }]}>
            <Button label="Add to inventory" onPress={() => save(false)} />
            <Button variant="secondary" label="Add + log spend" onPress={() => save(true)} />
          </View>
          <Muted>"Log spend" sends the total to Smart Shopping List for your budget.</Muted>
        </Card>
      )}
    </ScrollView>
  );
}
