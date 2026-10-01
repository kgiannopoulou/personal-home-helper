import { useKeepAwake } from 'expo-keep-awake';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, Vibration, View } from 'react-native';
import { Button, Card, colors, Muted, styles, Title } from '../../shared/ui';
import {
  clampLevel,
  daysUntilNextRun,
  describeLevel,
  formatClock,
  MAX_LEVEL,
  PLAN,
  positionAt,
  runSeconds,
  segmentsFor,
  totalSeconds,
  type Adaptation,
  type Segment,
} from '../../modules/activity/lib/coach';
import { useStore } from '../../modules/activity/lib/store';
import type { Feeling } from '../../modules/activity/lib/types';

type Stage =
  | { name: 'overview' }
  | { name: 'running'; level: number }
  | { name: 'feedback'; level: number; completed: boolean; seconds: number }
  | { name: 'result'; adaptation: Adaptation };

export default function Coach() {
  const { state, finishCoachSession } = useStore();
  const [stage, setStage] = useState<Stage>({ name: 'overview' });

  if (stage.name === 'running') {
    return (
      <Session
        level={stage.level}
        onEnd={(completed, seconds) => setStage({ name: 'feedback', level: stage.level, completed, seconds })}
      />
    );
  }

  if (stage.name === 'feedback') {
    const choose = (feeling: Feeling) => {
      const adaptation = finishCoachSession(stage.level, stage.completed, feeling, Math.round(stage.seconds / 60));
      setStage({ name: 'result', adaptation });
    };
    const options: { feeling: Feeling; label: string }[] = [
      { feeling: 'too_easy', label: '😎 Too easy, I could do more' },
      { feeling: 'just_right', label: '🙂 Just right' },
      { feeling: 'hard', label: '😮‍💨 Hard, but I managed' },
      { feeling: 'too_hard', label: '🥵 Too hard, I had to stop' },
      { feeling: 'pain', label: '🤕 Something hurts' },
    ];
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Card>
          <Title>{stage.completed ? '🎉 Session complete!' : 'Session ended early'}</Title>
          <Muted>
            You were out for {formatClock(stage.seconds)}. How did it feel? Your answer decides the next session.
          </Muted>
        </Card>
        {options
          .filter((o) => stage.completed || o.feeling === 'too_hard' || o.feeling === 'pain')
          .map((o) => (
            <Button key={o.feeling} variant="secondary" label={o.label} onPress={() => choose(o.feeling)} />
          ))}
      </ScrollView>
    );
  }

  if (stage.name === 'result') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Card>
          <Title>Next session</Title>
          <Text style={styles.text}>{stage.adaptation.message}</Text>
          <View style={{ height: 8 }} />
          <Muted>
            Level {stage.adaptation.level}: {describeLevel(stage.adaptation.level)} · rest {stage.adaptation.restDays} day
            {stage.adaptation.restDays > 1 ? 's' : ''} first. The run was saved to your log.
          </Muted>
          <View style={{ height: 12 }} />
          <Button label="Done" onPress={() => setStage({ name: 'overview' })} />
        </Card>
      </ScrollView>
    );
  }

  return <Overview level={state.coach.level} onStart={(level) => setStage({ name: 'running', level })} />;
}

function Overview({ level, onStart }: { level: number; onStart: (level: number) => void }) {
  const { state, setCoachLevel } = useStore();
  const [today, setToday] = useState(level);
  useEffect(() => setToday(level), [level]);
  const segments = segmentsFor(today);
  const restIn = daysUntilNextRun(state.coach.sessions);
  const recent = state.coach.sessions.slice(-5).reverse();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Title>Today's run</Title>
        <Text style={[styles.text, { fontSize: 17, fontWeight: '700' }]}>{describeLevel(today)}</Text>
        <Muted>
          5 min walk warm-up + {formatClock(runSeconds(segments))} running + 5 min cool-down · {Math.round(totalSeconds(segments) / 60)}{' '}
          min total
        </Muted>
        {today !== level && (
          <Text style={{ color: colors.warn, marginTop: 6 }}>
            Adjusted for today only (your plan is at level {level}).
          </Text>
        )}
        {restIn > 0 && (
          <Text style={{ color: colors.warn, marginTop: 6 }}>
            💤 Your body builds fitness while resting. We suggest waiting {restIn} more day{restIn > 1 ? 's' : ''}.
          </Text>
        )}
        <View style={{ height: 12 }} />
        <Text style={styles.label}>Does this plan work for you?</Text>
        <View style={styles.row}>
          <Button label="👍 Let's go" onPress={() => onStart(today)} />
          <Button variant="secondary" label="Make it easier" disabled={today <= 1} onPress={() => setToday(clampLevel(today - 1))} />
          <Button variant="secondary" label="I feel great: harder" disabled={today >= MAX_LEVEL} onPress={() => setToday(clampLevel(today + 1))} />
        </View>
        <Muted>Tip: run at a pace where you can still talk. Slow is fine!</Muted>
      </Card>

      <Card>
        <Title>Your plan</Title>
        <Muted>Tap a level to jump there (useful if you already run a bit).</Muted>
        {PLAN.map((_, i) => {
          const lvl = i + 1;
          const current = lvl === level;
          return (
            <Pressable key={lvl} onPress={() => setCoachLevel(lvl)} style={[styles.listItem, current && { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.text, current && { fontWeight: '700' }]}>
                {lvl < level ? '✅' : current ? '👉' : '⬜'} Level {lvl}
              </Text>
              <Muted>{describeLevel(lvl)}</Muted>
            </Pressable>
          );
        })}
      </Card>

      {recent.length > 0 && (
        <Card>
          <Title>Recent runs</Title>
          {recent.map((s) => (
            <View key={s.id} style={styles.listItem}>
              <Text style={styles.text}>
                {s.date} · level {s.level}
              </Text>
              <Muted>
                {s.completed ? '✓' : '✗'} {s.feeling.replace('_', ' ')}
              </Muted>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const CUE: Record<Segment['kind'], string> = {
  warmup: 'Warm up. Walk briskly for five minutes.',
  run: 'Start running!',
  walk: 'Walk now. Catch your breath.',
  cooldown: 'Great job. Cool down with an easy walk.',
};

const LABEL: Record<Segment['kind'], string> = {
  warmup: 'WARM-UP WALK',
  run: 'RUN',
  walk: 'WALK',
  cooldown: 'COOL-DOWN',
};

function Session({ level, onEnd }: { level: number; onEnd: (completed: boolean, seconds: number) => void }) {
  useKeepAwake();
  const segments = useRef(segmentsFor(level)).current;
  const total = totalSeconds(segments);
  // Time is derived from timestamps, not tick counts, so it stays correct if the JS thread stalls.
  const [base, setBase] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(Date.now());
  const [, setTick] = useState(0);
  const lastIndex = useRef(-1);
  const ended = useRef(false);

  const elapsed = base + (startedAt ? (Date.now() - startedAt) / 1000 : 0);
  const pos = positionAt(segments, elapsed);
  const seg = segments[pos.index];

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (ended.current) return;
    if (pos.done) {
      ended.current = true;
      Speech.speak('Session complete. Well done!');
      Vibration.vibrate([0, 400, 200, 400]);
      onEnd(true, total);
      return;
    }
    if (pos.index !== lastIndex.current) {
      lastIndex.current = pos.index;
      Speech.speak(CUE[seg.kind]);
      Vibration.vibrate(seg.kind === 'run' ? [0, 300, 150, 300] : 500);
    }
  }, [pos.index, pos.done, seg.kind, onEnd, total]);

  useEffect(() => () => void Speech.stop(), []);

  const pause = () => {
    if (startedAt) {
      setBase(elapsed);
      setStartedAt(null);
    } else {
      setStartedAt(Date.now());
    }
  };
  const skip = () => {
    setBase(elapsed + pos.remaining + 0.01);
    if (startedAt) setStartedAt(Date.now());
  };
  const next = segments[pos.index + 1];
  const reps = segments.filter((s) => s.kind === 'run').length;
  const bg = seg.kind === 'run' ? colors.primary : seg.kind === 'walk' ? colors.water : colors.muted;

  return (
    <View style={[styles.screen, { padding: 16, gap: 12 }]}>
      <View style={{ backgroundColor: bg, borderRadius: 24, padding: 24, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 2 }}>{LABEL[seg.kind]}</Text>
        {seg.rep && (
          <Text style={{ color: '#fff', opacity: 0.9 }}>
            {seg.kind === 'run' ? 'Run' : 'Walk'} {seg.rep} of {seg.kind === 'run' ? reps : reps - 1}
          </Text>
        )}
        <Text
          accessibilityRole="timer"
          style={{ color: '#fff', fontSize: 72, fontWeight: '800', fontVariant: ['tabular-nums'] }}
        >
          {formatClock(pos.remaining)}
        </Text>
        {next && <Text style={{ color: '#fff', opacity: 0.9 }}>Next: {LABEL[next.kind].toLowerCase()} {formatClock(next.seconds)}</Text>}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, (elapsed / total) * 100)}%`, backgroundColor: colors.primary }]} />
      </View>
      <Muted>
        {formatClock(elapsed)} of {formatClock(total)}
      </Muted>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Button label={startedAt ? '⏸ Pause' : '▶️ Resume'} onPress={pause} />
        </View>
        <View style={{ flex: 1 }}>
          <Button variant="secondary" label="⏭ Skip" onPress={skip} />
        </View>
      </View>
      <Button
        variant="danger"
        label="End run"
        // Ending during the cool-down still counts as finishing the session.
        onPress={() => {
          ended.current = true;
          onEnd(seg.kind === 'cooldown', Math.round(elapsed));
        }}
      />
    </View>
  );
}
