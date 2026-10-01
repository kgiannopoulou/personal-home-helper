import { Pressable, Text, View } from 'react-native';
import { dueInfo, dueText, formatMinutes } from '../lib/chores';
import { useStore } from '../lib/store';
import type { Task } from '../lib/types';
import { colors, Muted, styles } from '../../../shared/ui';

/** A chore with a tick button. Shows the room and who it's assigned to when useful. */
export function TaskRow({ task, showRoom = true }: { task: Task; showRoom?: boolean }) {
  const { state, completeTask } = useStore();
  const room = state.rooms.find((r) => r.id === task.roomId);
  const assignee = state.members.find((m) => m.id === task.assignee);
  const { status } = dueInfo(task);
  const details = [
    showRoom && room ? `${room.emoji} ${room.name}` : null,
    formatMinutes(task.minutes),
    dueText(task),
    assignee && state.members.length > 1 ? `👤 ${assignee.name}` : null,
  ].filter(Boolean);

  return (
    <View style={styles.listItem}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: false }}
        accessibilityLabel={`Mark ${task.name} done`}
        onPress={() => completeTask(task.id)}
        hitSlop={8}
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          borderWidth: 2,
          borderColor: status === 'overdue' ? colors.warn : colors.primary,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.text}>{task.name}</Text>
        <Muted>{details.join(' · ')}</Muted>
      </View>
    </View>
  );
}

export function DoneRow({ task }: { task: Task }) {
  const { undoTask } = useStore();
  return (
    <View style={styles.listItem}>
      <Text style={{ fontSize: 18 }}>✅</Text>
      <Text style={[styles.text, { flex: 1, color: colors.muted, textDecorationLine: 'line-through' }]}>{task.name}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Undo ${task.name}`} onPress={() => undoTask(task.id)} hitSlop={8}>
        <Text style={{ color: colors.primary }}>Undo</Text>
      </Pressable>
    </View>
  );
}
