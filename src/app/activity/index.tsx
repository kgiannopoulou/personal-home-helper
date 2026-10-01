import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Card, colors, Muted, Progress, styles, Title } from '../../shared/ui';
import { daysUntilNextRun, describeLevel } from '../../modules/activity/lib/coach';
import { toDateKey } from '../../shared/dates';
import { minutesUntilNextWorkout, stepsKcal, workoutFuelAdvice, WORKOUT_LABEL } from '../../modules/activity/lib/fitness';
import { useStore } from '../../modules/activity/lib/store';
import { useTodaySteps } from '../../modules/activity/lib/useSteps';

export default function Today() {
  const router = useRouter();
  const { state, ready, setSteps } = useStore();
  const { steps, source } = useTodaySteps();
  const [manual, setManual] = useState('');

  if (!ready) return null;
  const profile = state.profile;
  if (!profile) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Card>
          <Title>Welcome 👋</Title>
          <Muted>Add your weight, step goal and diet so the coach can personalise your training and fuel advice.</Muted>
          <View style={{ height: 12 }} />
          <Button label="Set up profile" onPress={() => router.push('/activity/profile')} />
        </Card>
      </ScrollView>
    );
  }

  const today = toDateKey();
  const todayWorkouts = state.workouts.filter((w) => w.date === today);
  const burned = todayWorkouts.reduce((s, w) => s + w.kcal, 0) + stepsKcal(steps, profile.weightKg);
  const lastNight = state.sleep.find((s) => s.date === today);
  const nextIn = minutesUntilNextWorkout(state.schedule);
  const advice = nextIn !== null && nextIn < 24 * 60 ? workoutFuelAdvice(nextIn, profile.diet) : null;
  const runIn = daysUntilNextRun(state.coach.sessions);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Title>Hi {profile.name || 'there'} 👋</Title>
        <Progress label="Steps" value={steps} target={profile.stepGoal} unit="" />
        <Muted>
          ≈ {burned} kcal burned today from steps and workouts ·{' '}
          {source === 'health' ? 'from your phone' : source === 'live' ? 'counting while the app is open' : 'enter steps from your watch'}
        </Muted>
        <View style={[styles.row, { marginTop: 8, alignItems: 'center' }]}>
          <TextInput
            value={manual}
            onChangeText={setManual}
            keyboardType="number-pad"
            placeholder="Set today's steps"
            placeholderTextColor={colors.muted}
            style={[styles.input, { flex: 1 }]}
          />
          <Button
            variant="secondary"
            label="Save"
            disabled={!(Number(manual) >= 0) || manual === ''}
            onPress={() => {
              setSteps(today, Number(manual));
              setManual('');
            }}
          />
        </View>
      </Card>

      {advice && (
        <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
          <Title>
            🍌 {advice.title} ({WORKOUT_LABEL[state.schedule.type]})
          </Title>
          <Text style={styles.text}>🍽️ {advice.eat}</Text>
          <Text style={[styles.text, { marginTop: 4 }]}>💧 {advice.drink}</Text>
          {advice.ideas.length > 0 && <Muted>Ideas: {advice.ideas.join(' · ')}</Muted>}
        </Card>
      )}

      <Card>
        <Title>🏃 Running coach</Title>
        <Text style={styles.text}>
          Level {state.coach.level}: {describeLevel(state.coach.level)}
        </Text>
        <Muted>
          {runIn === 0 ? 'Your next run is ready today.' : runIn === 1 ? 'Rest day today. Next run tomorrow.' : `Rest for ${runIn} more days.`}
        </Muted>
        <View style={{ height: 8 }} />
        <Button label={runIn === 0 ? 'Start run' : 'Open coach'} onPress={() => router.push('/activity/coach')} />
      </Card>

      <Card>
        <Title>Today</Title>
        {todayWorkouts.length === 0 && <Muted>No workouts logged yet.</Muted>}
        {todayWorkouts.map((w) => (
          <View key={w.id} style={styles.listItem}>
            <Text style={styles.text}>
              {WORKOUT_LABEL[w.type]} · {w.minutes} min
            </Text>
            <Muted>{w.kcal} kcal</Muted>
          </View>
        ))}
        <View style={[styles.listItem, { borderBottomWidth: 0 }]}>
          <Text style={styles.text}>😴 Last night</Text>
          <Muted>{lastNight ? `${lastNight.hours} h (goal ${profile.sleepGoalHours} h)` : 'Not logged'}</Muted>
        </View>
      </Card>
    </ScrollView>
  );
}
