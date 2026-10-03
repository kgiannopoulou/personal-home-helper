import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, colors, Muted, styles, Title } from '../../../shared/ui';
import { changeText, type Plan } from '../lib/plan';

/**
 * A plan the assistant proposed. Nothing changes in the app until the user taps Apply;
 * they can untick changes they don't want first.
 */
export function PlanCard({ plan, onApply, disabled }: { plan: Plan; onApply: (indexes: number[]) => void; disabled?: boolean }) {
  const [skipped, setSkipped] = useState<number[]>([]);
  const chosen = plan.changes.map((_, i) => i).filter((i) => !skipped.includes(i));
  const applied = !!plan.applied;

  return (
    <Card style={{ borderColor: colors.primary, alignSelf: 'stretch' }}>
      <Title>🗓️ {plan.title}</Title>
      <Muted>{plan.summary}</Muted>
      <View style={{ gap: 2, marginTop: 4 }}>
        {plan.changes.map((c, i) => {
          const on = !skipped.includes(i);
          return (
            <Pressable
              key={i}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled: applied }}
              disabled={applied}
              onPress={() => setSkipped((s) => (on ? [...s, i] : s.filter((x) => x !== i)))}
              style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}
            >
              {!applied && <Text style={{ fontSize: 16, color: on ? colors.primary : colors.muted }}>{on ? '☑' : '☐'}</Text>}
              <Text style={[styles.text, { flex: 1 }, !on && !applied && { color: colors.muted, textDecorationLine: 'line-through' }]}>{changeText(c)}</Text>
            </Pressable>
          );
        })}
      </View>
      {applied ? (
        <View style={{ gap: 2, marginTop: 4 }}>
          {plan.applied!.map((line, i) => (
            <Text key={i} style={{ fontSize: 13, color: colors.primary }}>
              ✓ {line}
            </Text>
          ))}
        </View>
      ) : (
        <Button
          label={chosen.length === plan.changes.length ? `Apply ${chosen.length} change${chosen.length === 1 ? '' : 's'}` : `Apply ${chosen.length} of ${plan.changes.length}`}
          disabled={disabled || chosen.length === 0}
          onPress={() => onApply(chosen)}
        />
      )}
    </Card>
  );
}
