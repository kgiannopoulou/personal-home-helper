import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, ChipRow, colors, Field, Muted, styles, Title } from '../../shared/ui';
import { nutrientsFor, searchFoods, type Food } from '../../modules/food/lib/foods';
import { estimateMeal, MealAIError, type MealEstimate } from '../../modules/food/lib/mealAI';
import { getApiKey } from '../../modules/food/lib/storage';
import { useStore } from '../../modules/food/lib/store';
import type { Meal } from '../../modules/food/lib/types';

type Mode = 'search' | 'ai' | 'custom';

function mealForNow(): Meal {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

const MEAL_OPTIONS = (['breakfast', 'lunch', 'dinner', 'snack'] as const).map((m) => ({
  value: m,
  label: m[0].toUpperCase() + m.slice(1),
}));

export default function LogFood() {
  const [mode, setMode] = useState<Mode>('search');
  const [meal, setMeal] = useState<Meal>(mealForNow());

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ChipRow
        value={mode}
        onChange={setMode}
        options={[
          { value: 'search', label: '🔎 Search' },
          { value: 'ai', label: '📷 Photo / describe (AI)' },
          { value: 'custom', label: '✏️ Custom' },
        ]}
      />
      <Card>
        <Text style={styles.label}>Meal</Text>
        <ChipRow value={meal} onChange={setMeal} options={MEAL_OPTIONS} />
      </Card>
      {mode === 'search' && <SearchLog meal={meal} />}
      {mode === 'ai' && <AILog meal={meal} />}
      {mode === 'custom' && <CustomLog meal={meal} />}
    </ScrollView>
  );
}

function useFlash() {
  const [message, setMessage] = useState('');
  const flash = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage(''), 2500);
  };
  const node = message ? <Text style={{ color: colors.primary, fontWeight: '600', marginTop: 8 }}>{message}</Text> : null;
  return [flash, node] as const;
}

function SearchLog({ meal }: { meal: Meal }) {
  const { state, addFood } = useStore();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Food | null>(null);
  const [grams, setGrams] = useState('');
  const [flash, flashNode] = useFlash();
  const results = searchFoods(query, state.profile?.diet ?? 'omnivore').slice(0, 12);

  const g = Number(grams);
  const preview = selected && g > 0 ? nutrientsFor(selected, g) : null;

  return (
    <Card>
      <Field label="Search foods" value={query} onChangeText={setQuery} placeholder="e.g. lentils, egg, rice" />
      {selected ? (
        <View>
          <Text style={[styles.text, { fontWeight: '700' }]}>{selected.name}</Text>
          <Muted>
            Typical portion: {selected.servingLabel} ({selected.serving} g)
          </Muted>
          <View style={{ height: 8 }} />
          <Field label="Amount (g)" value={grams} onChangeText={setGrams} keyboardType="decimal-pad" />
          {preview && (
            <Muted>
              {preview.kcal} kcal · P {preview.protein} g · C {preview.carbs} g · F {preview.fat} g · fibre {preview.fiber} g
            </Muted>
          )}
          <View style={[styles.row, { marginTop: 12 }]}>
            <Button
              label="Log it"
              disabled={!preview}
              onPress={() => {
                if (!preview) return;
                addFood({ name: selected.name, grams: g, meal, source: 'database', ...preview });
                flash(`Logged ${selected.name} ✓`);
                setSelected(null);
              }}
            />
            <Button variant="secondary" label="Back" onPress={() => setSelected(null)} />
          </View>
        </View>
      ) : (
        results.map((food) => (
          <Pressable
            key={food.name}
            style={styles.listItem}
            onPress={() => {
              setSelected(food);
              setGrams(String(food.serving));
            }}
          >
            <Text style={styles.text}>{food.name}</Text>
            <Muted>{food.per100.kcal} kcal/100 g</Muted>
          </Pressable>
        ))
      )}
      {flashNode}
    </Card>
  );
}

function AILog({ meal }: { meal: Meal }) {
  const { state, addFood } = useStore();
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; base64: string; mimeType?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<MealEstimate | null>(null);
  const [flash, flashNode] = useFlash();

  const pick = async (source: 'camera' | 'library') => {
    setError('');
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], base64: true, quality: 0.5 };
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setError('Camera permission is needed to take a photo.');
    }
    const res =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = res.canceled ? null : res.assets[0];
    if (asset?.base64) setPhoto({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType ?? undefined });
  };

  const analyse = async () => {
    setError('');
    setResult(null);
    const key = await getApiKey();
    if (!key) return setError('Add your Anthropic API key in the Profile tab to use AI features.');
    setLoading(true);
    try {
      const mediaType = photo?.mimeType === 'image/png' || photo?.mimeType === 'image/webp' ? photo.mimeType : 'image/jpeg';
      setResult(
        await estimateMeal(key, {
          imageBase64: photo?.base64,
          mediaType,
          text,
          diet: state.profile?.diet ?? 'omnivore',
        }),
      );
    } catch (e) {
      setError(e instanceof MealAIError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const logAll = () => {
    if (!result) return;
    for (const item of result.items) {
      addFood({
        name: item.name,
        grams: Math.round(item.grams),
        meal,
        source: 'ai',
        kcal: Math.round(item.kcal),
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        fiber: item.fiber,
      });
    }
    flash(`Logged ${result.items.length} item(s) ✓`);
    setResult(null);
    setPhoto(null);
    setText('');
  };

  return (
    <Card>
      <Title>Snap or say what you ate</Title>
      <Muted>Take a photo of your plate and/or describe it, e.g. “2 eggs, a slice of toast and a latte”.</Muted>
      <View style={[styles.row, { marginVertical: 12 }]}>
        <Button variant="secondary" label="📷 Camera" onPress={() => pick('camera')} />
        <Button variant="secondary" label="🖼️ Gallery" onPress={() => pick('library')} />
        {photo && <Button variant="secondary" label="Remove photo" onPress={() => setPhoto(null)} />}
      </View>
      {photo && <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 200, borderRadius: 12, marginBottom: 12 }} />}
      <Field label="Description (optional with a photo)" value={text} onChangeText={setText} multiline />
      <Button label={loading ? 'Analysing…' : 'Estimate calories'} onPress={analyse} disabled={loading} />
      {loading && <ActivityIndicator style={{ marginTop: 12 }} color={colors.primary} />}
      {!!error && <Text style={{ color: colors.danger, marginTop: 8 }}>{error}</Text>}
      {result && (
        <View style={{ marginTop: 12 }}>
          {result.items.map((item, i) => (
            <View key={i} style={styles.listItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.text}>
                  {item.name} · {Math.round(item.grams)} g
                </Text>
                <Muted>
                  {Math.round(item.kcal)} kcal · P {item.protein} g · C {item.carbs} g · F {item.fat} g
                </Muted>
              </View>
            </View>
          ))}
          <Muted>
            Total: {Math.round(result.items.reduce((s, i) => s + i.kcal, 0))} kcal · confidence {result.confidence}
          </Muted>
          {!!result.notes && <Muted>ℹ️ {result.notes}</Muted>}
          <View style={[styles.row, { marginTop: 12 }]}>
            <Button label="Log all" onPress={logAll} disabled={result.items.length === 0} />
            <Button variant="secondary" label="Discard" onPress={() => setResult(null)} />
          </View>
        </View>
      )}
      {flashNode}
    </Card>
  );
}

function CustomLog({ meal }: { meal: Meal }) {
  const { addFood } = useStore();
  const [f, setF] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '', fiber: '' });
  const [flash, flashNode] = useFlash();
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const num = (v: string) => Number(v.replace(',', '.')) || 0;

  return (
    <Card>
      <Field label="Name" value={f.name} onChangeText={set('name')} placeholder="e.g. Grandma's moussaka" />
      <Field label="Calories (kcal)" value={f.kcal} onChangeText={set('kcal')} keyboardType="decimal-pad" />
      <View style={styles.row}>
        {(['protein', 'carbs', 'fat', 'fiber'] as const).map((k) => (
          <View key={k} style={{ flexBasis: '45%', flexGrow: 1 }}>
            <Field label={`${k === 'fiber' ? 'Fibre' : k[0].toUpperCase() + k.slice(1)} (g)`} value={f[k]} onChangeText={set(k)} keyboardType="decimal-pad" />
          </View>
        ))}
      </View>
      <Button
        label="Log it"
        disabled={!f.name.trim() || !(num(f.kcal) > 0)}
        onPress={() => {
          addFood({
            name: f.name.trim(),
            meal,
            source: 'custom',
            kcal: num(f.kcal),
            protein: num(f.protein),
            carbs: num(f.carbs),
            fat: num(f.fat),
            fiber: num(f.fiber),
          });
          flash(`Logged ${f.name.trim()} ✓`);
          setF({ name: '', kcal: '', protein: '', carbs: '', fat: '', fiber: '' });
        }}
      />
      {flashNode}
    </Card>
  );
}
