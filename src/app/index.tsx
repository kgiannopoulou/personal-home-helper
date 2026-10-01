import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { weatherLabel } from '../modules/weather/lib/weather';
import { time } from '../modules/planner/lib/planner';
import { useHub } from '../shared/useHub';
import { Card, colors, Muted, styles, Title } from '../shared/ui';

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
  const { now, tips, food, activity, kitchen, shopping, money, chores, planner, weather } = hub;
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const nextEvent = planner.events.find((e) => !e.allDay && new Date(e.end) > now);
  const cur = weather.forecast ? weatherLabel(weather.forecast.current.code) : null;
  const fmt = (n: number, c: string) => `${c}${n.toFixed(0)}`;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: 56 }]}>
      <View>
        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text }}>{greeting} 👋</Text>
        <Muted>
          {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          {cur && weather.forecast ? ` · ${cur.emoji} ${Math.round(weather.forecast.current.temp)}°` : ''}
        </Muted>
      </View>

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
          sub={shopping.estimate ? `≈ ${fmt(shopping.estimate, shopping.currency)}` : undefined}
        />
        <Tile
          emoji="💶"
          title="Money"
          href="/money"
          highlight={money.budget > 0 && money.spent > money.budget}
          line={`${fmt(money.spent, money.currency)} this month`}
          sub={money.budget ? `of ${fmt(money.budget, money.currency)} budget` : 'No budget set'}
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
