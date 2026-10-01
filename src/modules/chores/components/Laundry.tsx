import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { formatMinutes, laundryStatus } from '../lib/chores';
import { useStore } from '../lib/store';
import { Button, Card, colors, Muted, Title } from '../../../shared/ui';

/** Re-renders every minute so due dates and the laundry countdown stay current. */
export function useNow(): Date {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function LaundryCard() {
  const { state, finishLaundry } = useStore();
  const now = useNow();
  if (!state.laundry) return null;
  const { ready, minutesLeft, readyAt } = laundryStatus(state.laundry, now);
  return (
    <Card style={{ backgroundColor: ready ? colors.warnSoft : colors.waterSoft }}>
      <Title>🧺 {ready ? 'Laundry may be ready' : `Laundry: ${formatMinutes(minutesLeft)} left`}</Title>
      <Muted>
        {state.laundry.type[0].toUpperCase() + state.laundry.type.slice(1)} load · started{' '}
        {new Date(state.laundry.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ready around{' '}
        {readyAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Muted>
      <View style={{ height: 10 }} />
      <Button label={ready ? 'Hung it up ✓' : 'Cancel load'} variant={ready ? 'primary' : 'secondary'} onPress={finishLaundry} />
    </Card>
  );
}
