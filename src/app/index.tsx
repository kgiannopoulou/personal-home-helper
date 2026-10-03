import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { PlanCard } from '../modules/assistant/components/PlanCard';
import { useProactive } from '../modules/assistant/lib/useProactive';
import { usePrepared } from '../shared/PredictionsRunner';
import { weatherLabel } from '../modules/weather/lib/weather';
import { time } from '../modules/planner/lib/planner';
import { useHub } from '../shared/useHub';
import { Card, colors, Muted, styles, Title } from '../shared/ui';
import { useSync } from '../shared/sync/SyncProvider';

function Tile({ emoji, title, line, sub, href, highlight }: { emoji: string; title: string; line: string; sub?: string; href: Href; highlight?: boolean }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${line}`}
      onPress={() => router.push(href)}
      style={({ pressed }) => [
        styles.card,
        { flexBasis: '47%', flexGrow: 1, padding: 14, gap: 2, opacity: pressed ? 0.8 : 1 },
        highlight && { borderColor: colors.warn, backgroundColor: colors.warnSoft },
      ]}
    >
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text style={styles.label}>{title}</Text>
      <Text style={styles.text} numberOfLines={2}>
        {line}
      </Text>
      {!!sub && (
        <Text style={styles.muted} numberOfLines={2}>
          {sub}
        </Text>
      )}
    </Pressable>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{children}</View>;
}

export default function Hub() {
  const hub = useHub();
  const router = useRouter();
  const proactive = useProactive();
  const { briefing, review } = proactive;
  const prepared = usePrepared();
  const sync = useSync();
  const { now, tips, food, activity, kitchen, shopping, money, chores, planner, weather } = hub;
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const nextEvent = planner.events.find((e) => !e.allDay && new Date(e.end) > now);
  const cur = weather.forecast ? weatherLabel(weather.forecast.current.code) : null;
  const fmt = (n: number, c: string) => `${c}${n.toFixed(0)}`;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: 56 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text }}>{greeting} 👋</Text>
          <Muted>
            {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
            {cur && weather.forecast ? ` · ${cur.emoji} ${Math.round(weather.forecast.current.temp)}°` : ''}
          </Muted>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Account and sync" onPress={() => router.push('/settings' as Href)} hitSlop={10}>
          <Text style={{ fontSize: 24 }}>{sync.account?.household ? (sync.status.error ? '⚠️' : '🔄') : '⚙️'}</Text>
        </Pressable>
      </View>

      {(briefing || proactive.working === 'briefing' || proactive.error) && (
        <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
          <View style={[styles.progressHeader, { alignItems: 'center' }]}>
            <Title>{briefing && briefing.date > hub.planner.date ? '🌙 For tomorrow' : '✨ Your nudges today'}</Title>
            {!!briefing && !proactive.working && (
              <Pressable accessibilityRole="button" accessibilityLabel="Write new nudges" onPress={proactive.refreshBriefing} hitSlop={8}>
                <Text style={{ color: colors.primary }}>↻</Text>
              </Pressable>
            )}
          </View>
          {proactive.working === 'briefing' && <Muted>Looking at your day and the last few weeks…</Muted>}
          {!briefing && proactive.error && proactive.working !== 'briefing' && <Muted>{proactive.error}</Muted>}
          {briefing?.nudges.map((n, i) => (
            <Pressable key={i} accessibilityRole="button" onPress={() => router.push(`/${n.module}` as Href)} style={{ flexDirection: 'row', gap: 8, paddingVertical: 6 }}>
              <Text style={{ fontSize: 18 }}>{n.emoji}</Text>
              <Text style={[styles.text, { flex: 1 }]}>{n.text}</Text>
            </Pressable>
          ))}
        </Card>
      )}

      {(review || proactive.working === 'review') && (
        <Card>
          <Title>📋 Your week in review</Title>
          {!review ? (
            <Muted>Writing your weekly review and a plan for next week…</Muted>
          ) : (
            <>
              <Text style={styles.label}>{review.headline}</Text>
              <Text style={styles.text}>💶 {review.budget}</Text>
              <Text style={styles.text}>🥗 {review.nutrition}</Text>
              <Text style={styles.text}>🧹 {review.chores}</Text>
            </>
          )}
        </Card>
      )}
      {review?.plan && <PlanCard plan={review.plan} onApply={proactive.applyReviewPlan} />}

      <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
        <Title>🧠 Today, joined up</Title>
        {tips.length === 0 && <Muted>Nothing needs your attention right now. Enjoy your day ✨</Muted>}
        {tips.map((t) => (
          <Pressable key={t.id} accessibilityRole="button" onPress={() => router.push(t.href as Href)} style={{ flexDirection: 'row', gap: 8, paddingVertical: 6 }}>
            <Text style={{ fontSize: 18 }}>{t.emoji}</Text>
            <Text style={[styles.text, { flex: 1 }]}>{t.text}</Text>
          </Pressable>
        ))}
      </Card>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/assistant')}
        style={({ pressed }) => [styles.card, { flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.85 : 1 }]}
      >
        <Text style={{ fontSize: 26 }}>🧠</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Ask Home Helper</Text>
          <Muted>“Plan my day” · “What can I cook tonight?” · “I finished the milk”</Muted>
        </View>
        <Text style={{ fontSize: 20, color: colors.primary }}>›</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/quick')}
        style={({ pressed }) => [styles.button, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
      >
        <Text style={[styles.buttonText, { color: '#fff' }]}>⚡ Quick actions: water, “I finished…”, run, 10 free minutes</Text>
      </Pressable>

      <Grid>
        <Tile
          emoji="📅"
          title="Planner"
          href="/planner"
          line={nextEvent ? `${time(nextEvent.start)} ${nextEvent.title}` : planner.events.length ? `${planner.events.length} events today` : 'Nothing booked'}
          sub={[planner.todos.length && `${planner.todos.length} to-do${planner.todos.length > 1 ? 's' : ''}`, planner.admin.length && `${planner.admin.length} admin`, planner.birthdays[0] && `🎂 ${planner.birthdays[0].person.name}`]
            .filter(Boolean)
            .join(' · ')}
        />
        <Tile emoji="🌦️" title="Weather" href="/weather" line={weather.outfit?.headline ?? 'Open for the forecast'} sub={weather.outfit?.summary} />
        <Tile
          emoji="🍽️"
          title="Food & water"
          href="/food"
          line={`💧 ${food.waterMl} / ${food.waterGoal} ml`}
          sub={food.kcalGoal ? `${food.kcal} / ${food.kcalGoal} kcal` : `${food.kcal} kcal logged`}
        />
        <Tile emoji="🏃" title="Activity" href="/activity" line={`${activity.steps.toLocaleString()} / ${activity.stepGoal.toLocaleString()} steps`} sub={`Run coach level ${activity.level}`} />
        <Tile
          emoji="🥫"
          title="Kitchen"
          href="/kitchen"
          highlight={kitchen.expiring.length > 0}
          line={kitchen.expiring.length ? `Use soon: ${kitchen.expiring.slice(0, 2).join(', ')}` : kitchen.total ? 'Everything fresh' : 'Add or scan your food'}
          sub={`${kitchen.total} items at home`}
        />
        <Tile
          emoji="🛒"
          title="Shopping"
          href="/shopping"
          line={shopping.count ? `${shopping.count} item${shopping.count > 1 ? 's' : ''} to buy` : 'List is empty'}
          sub={
            [
              shopping.estimate ? `≈ ${fmt(shopping.estimate, shopping.currency)}` : '',
              shopping.day ? `🗓️ ${shopping.day.next === hub.planner.date ? 'Shopping day today' : `Shops on ${shopping.day.name.slice(0, 3)}`}` : '',
              prepared && prepared.items.length && prepared.date >= hub.planner.date ? `${prepared.items.length} added for it` : '',
            ]
              .filter(Boolean)
              .join(' · ') || undefined
          }
        />
        <Tile
          emoji="💶"
          title="Money"
          href="/money"
          highlight={(money.budget > 0 && money.spent > money.budget) || (money.forecast?.over ?? 0) > 0}
          line={`${fmt(money.spent, money.currency)} this month`}
          sub={money.forecast ? `🔮 ${money.forecast.text}` : money.budget ? `of ${fmt(money.budget, money.currency)} budget` : 'No budget set'}
        />
        <Tile
          emoji="🧹"
          title="Chores"
          href="/chores"
          line={chores.count ? `${chores.count} task${chores.count > 1 ? 's' : ''} · ${chores.minutes} min` : 'All done for today'}
          sub={chores.laundry ? '🧺 Laundry running' : undefined}
        />
      </Grid>
      <Muted>Every section works on its own too. Tap a tile to open it, and “‹ Home” brings you back here.</Muted>
    </ScrollView>
  );
}
