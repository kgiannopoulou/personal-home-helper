import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { DateField, isDateKey } from '../../modules/planner/components/DateField';
import { Button, Card, ChipRow, colors, Field, Muted, styles, Title } from '../../shared/ui';
import { toDateKey } from '../../shared/dates';
import { addDays, openTodos, prettyDay, sortTodos } from '../../modules/planner/lib/planner';
import { useStore } from '../../modules/planner/lib/store';
import type { Todo } from '../../modules/planner/lib/types';

const MINUTES = [
  { value: '', label: '?' },
  { value: '5', label: '5 min' },
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '60', label: '1 h' },
  { value: '120', label: '2 h' },
];

function TodoRow({ todo }: { todo: Todo }) {
  const { toggleTodo, removeTodo } = useStore();
  const today = toDateKey();
  return (
    <View style={styles.listItem}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!todo.done }} onPress={() => toggleTodo(todo.id)} hitSlop={8}>
        <Text style={{ fontSize: 20 }}>{todo.done ? '✅' : '⬜'}</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={[styles.text, todo.done && { color: colors.muted, textDecorationLine: 'line-through' }]}>{todo.title}</Text>
        {!!(todo.due || todo.minutes) && (
          <Muted>
            {todo.due ? (todo.due < today && !todo.done ? `⚠️ ${prettyDay(todo.due, today)}` : prettyDay(todo.due, today)) : ''}
            {todo.due && todo.minutes ? ' · ' : ''}
            {todo.minutes ? `${todo.minutes} min` : ''}
          </Muted>
        )}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${todo.title}`} onPress={() => removeTodo(todo.id)} hitSlop={8}>
        <Text style={{ color: colors.muted }}>✕</Text>
      </Pressable>
    </View>
  );
}

export default function Todos() {
  const { state, addTodo } = useStore();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [minutes, setMinutes] = useState('');
  const today = toDateKey();
  const weekEnd = addDays(today, 7);
  const open = sortTodos(openTodos(state.todos));
  const groups: [string, Todo[]][] = [
    ['⚠️ Overdue', open.filter((t) => t.due && t.due < today)],
    ['Today', open.filter((t) => t.due === today)],
    ['Next 7 days', open.filter((t) => t.due && t.due > today && t.due <= weekEnd)],
    ['Later', open.filter((t) => t.due && t.due > weekEnd)],
    ['Someday', open.filter((t) => !t.due)],
  ];
  const done = state.todos
    .filter((t) => t.done)
    .sort((a, b) => (b.done ?? '').localeCompare(a.done ?? ''))
    .slice(0, 10);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Title>Add a to-do</Title>
        <Field label="What" value={title} onChangeText={setTitle} placeholder="e.g. Return the package" />
        <DateField label="When (optional)" value={due} onChange={setDue} />
        <ChipRow options={MINUTES} value={minutes} onChange={setMinutes} />
        <Muted>How long it takes helps fit it into free time in your day.</Muted>
        <View style={{ height: 10 }} />
        <Button
          label="Add"
          disabled={!title.trim() || (!!due && !isDateKey(due))}
          onPress={() => {
            addTodo({ title: title.trim(), due: due || undefined, minutes: minutes ? Number(minutes) : undefined });
            setTitle('');
            setDue('');
            setMinutes('');
          }}
        />
      </Card>

      {open.length === 0 && (
        <Card>
          <Muted>Nothing to do. Enjoy! ✨</Muted>
        </Card>
      )}
      {groups.map(([label, list]) =>
        list.length ? (
          <Card key={label}>
            <Title>{label}</Title>
            {list.map((t) => (
              <TodoRow key={t.id} todo={t} />
            ))}
          </Card>
        ) : null,
      )}
      {done.length > 0 && (
        <Card>
          <Title>Done recently</Title>
          {done.map((t) => (
            <TodoRow key={t.id} todo={t} />
          ))}
        </Card>
      )}
    </ScrollView>
  );
}
