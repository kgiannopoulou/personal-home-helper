import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, Chip, colors, Field, Muted, styles, Title } from '../../shared/ui';
import { dueInfo, dueText, formatMinutes, FREQUENCIES, frequencyLabel, usualWeekday, WEEKDAYS } from '../../modules/chores/lib/chores';
import { useStore } from '../../modules/chores/lib/store';
import type { Room, Task } from '../../modules/chores/lib/types';

const DAY = 24 * 60 * 60 * 1000;
const LAST_DONE = [
  { label: 'Today', days: 0 },
  { label: '3 days ago', days: 3 },
  { label: 'A week ago', days: 7 },
  { label: '2 weeks ago', days: 14 },
  { label: 'A month ago', days: 30 },
];

function TaskEditor({ task, onClose }: { task: Task; onClose: () => void }) {
  const { state, updateTask, removeTask } = useStore();
  const [name, setName] = useState(task.name);
  const [minutes, setMinutes] = useState(String(task.minutes));
  const [every, setEvery] = useState(task.everyDays);
  const [custom, setCustom] = useState(FREQUENCIES.some((f) => f.days === task.everyDays) ? '' : String(task.everyDays));
  const [assignee, setAssignee] = useState(task.assignee);
  const m = Number(minutes);
  const everyDays = custom ? Number(custom) : every;
  const valid = !!name.trim() && Number.isInteger(m) && m >= 1 && m <= 480 && Number.isInteger(everyDays) && everyDays >= 1 && everyDays <= 365;
  const usual = usualWeekday(task.id, state.completions);

  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Field label="Task" value={name} onChangeText={setName} />
      <Field label="How long it takes you (minutes)" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" />
      <Text style={styles.label}>How often</Text>
      <View style={styles.row}>
        {FREQUENCIES.map((f) => (
          <Chip
            key={f.days}
            label={f.label}
            selected={!custom && every === f.days}
            onPress={() => {
              setEvery(f.days);
              setCustom('');
            }}
          />
        ))}
      </View>
      <View style={{ height: 8 }} />
      <Field label="…or every N days" value={custom} onChangeText={setCustom} keyboardType="number-pad" placeholder="e.g. 10" />
      <Text style={styles.label}>Last done</Text>
      <View style={styles.row}>
        {LAST_DONE.map((o) => (
          <Chip
            key={o.label}
            label={o.label}
            onPress={() => updateTask(task.id, { lastDone: new Date(Date.now() - o.days * DAY).toISOString() })}
          />
        ))}
      </View>
      <View style={{ height: 4 }} />
      <Muted>
        {dueText(task)}
        {usual !== null ? ` · usually on ${WEEKDAYS[usual]}s` : ''}
      </Muted>
      {state.members.length > 0 && (
        <>
          <View style={{ height: 8 }} />
          <Text style={styles.label}>Who does it</Text>
          <View style={styles.row}>
            <Chip label="Anyone" selected={!assignee} onPress={() => setAssignee(undefined)} />
            {state.members.map((mem) => (
              <Chip key={mem.id} label={mem.name} selected={assignee === mem.id} onPress={() => setAssignee(mem.id)} />
            ))}
          </View>
        </>
      )}
      <View style={{ height: 12 }} />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Button
            label="Save"
            disabled={!valid}
            onPress={() => {
              updateTask(task.id, { name: name.trim(), minutes: m, everyDays, assignee });
              onClose();
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Delete" variant="danger" onPress={() => removeTask(task.id)} />
        </View>
      </View>
    </View>
  );
}

function RoomCard({ room }: { room: Room }) {
  const { state, addTask, removeRoom } = useStore();
  const tasks = state.tasks.filter((t) => t.roomId === room.id).sort((a, b) => a.everyDays - b.everyDays || a.name.localeCompare(b.name));
  const [editing, setEditing] = useState<string | null>(null);
  const [newTask, setNewTask] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const weekly = Math.round(tasks.reduce((m, t) => m + (t.minutes * 7) / t.everyDays, 0));

  return (
    <Card>
      <Title>
        {room.emoji} {room.name}
      </Title>
      <Muted>
        {tasks.length} task{tasks.length === 1 ? '' : 's'} · about {formatMinutes(weekly)} a week
        {room.personal ? ' · personal routines' : ''}
      </Muted>
      {tasks.map((t) =>
        editing === t.id ? (
          <TaskEditor key={t.id} task={t} onClose={() => setEditing(null)} />
        ) : (
          <Pressable key={t.id} accessibilityRole="button" onPress={() => setEditing(t.id)} style={styles.listItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.text}>{t.name}</Text>
              <Muted>
                {frequencyLabel(t.everyDays)} · {formatMinutes(t.minutes)}
                {t.assignee ? ` · 👤 ${state.members.find((m) => m.id === t.assignee)?.name ?? ''}` : ''}
              </Muted>
            </View>
            <Text style={[styles.muted, dueInfo(t).status === 'overdue' && { color: colors.warn }]}>{dueText(t)}</Text>
          </Pressable>
        ),
      )}
      <View style={{ height: 10 }} />
      <View style={[styles.row, { alignItems: 'flex-end' }]}>
        <View style={{ flex: 1 }}>
          <Field label="Add a task" value={newTask} onChangeText={setNewTask} placeholder={room.personal ? 'e.g. Skincare' : 'e.g. Dust shelves'} />
        </View>
        <View style={{ marginBottom: 12 }}>
          <Button
            label="Add"
            variant="secondary"
            disabled={!newTask.trim()}
            onPress={() => {
              addTask({ name: newTask.trim(), roomId: room.id, everyDays: 7, minutes: 10 });
              setNewTask('');
            }}
          />
        </View>
      </View>
      {confirmDelete ? (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Button label={`Delete ${room.name} and its tasks`} variant="danger" onPress={() => removeRoom(room.id)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Keep" variant="secondary" onPress={() => setConfirmDelete(false)} />
          </View>
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setConfirmDelete(true)}>
          <Text style={{ color: colors.danger, textAlign: 'right' }}>Delete room</Text>
        </Pressable>
      )}
    </Card>
  );
}

const ROOM_EMOJI = ['🛏️', '🛋️', '🍳', '🚿', '🧺', '🌳', '🚗', '🧸', '💻', '🐕', '🧴', '🔧'];

export default function Rooms() {
  const { state, addRoom } = useStore();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🛏️');
  const [personal, setPersonal] = useState(false);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Muted>
          Tap a task to change how long it takes you, how often it's needed, or who does it. Personal routines like skincare go
          in "Me".
        </Muted>
      </Card>
      {state.rooms.map((r) => (
        <RoomCard key={r.id} room={r} />
      ))}
      <Card>
        <Title>Add a room</Title>
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Balcony" />
        <View style={styles.row}>
          {ROOM_EMOJI.map((e) => (
            <Chip key={e} label={e} selected={emoji === e} onPress={() => setEmoji(e)} />
          ))}
        </View>
        <View style={{ height: 8 }} />
        <View style={styles.row}>
          <Chip label="🧹 Cleaning" selected={!personal} onPress={() => setPersonal(false)} />
          <Chip label="🧴 Personal routines" selected={personal} onPress={() => setPersonal(true)} />
        </View>
        <View style={{ height: 12 }} />
        <Button
          label="Add room"
          disabled={!name.trim()}
          onPress={() => {
            addRoom({ name: name.trim(), emoji, ...(personal ? { personal: true } : {}) });
            setName('');
            setPersonal(false);
          }}
        />
      </Card>
    </ScrollView>
  );
}
