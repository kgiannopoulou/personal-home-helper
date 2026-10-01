import { View } from 'react-native';
import { useStore } from '../lib/store';
import type { PlaceKind } from '../lib/types';
import { Chip, styles } from '../../../shared/ui';

export const PLACE_EMOJI: Record<PlaceKind, string> = { home: '🏠', work: '💼', gym: '🏋️', other: '📍' };

/** Switch between your location and saved places (home, work, gym). */
export function PlacePicker() {
  const { state, selectPlace } = useStore();
  if (!state.places.length) return null;
  return (
    <View style={styles.row}>
      <Chip label="📡 Here" selected={state.settings.useGps} onPress={() => selectPlace(null)} />
      {state.places.map((p) => (
        <Chip
          key={p.id}
          label={`${PLACE_EMOJI[p.kind]} ${p.name}`}
          selected={!state.settings.useGps && state.settings.activePlaceId === p.id}
          onPress={() => selectPlace(p.id)}
        />
      ))}
    </View>
  );
}
