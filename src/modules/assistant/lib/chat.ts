import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages';
import { newId, toDateKey } from '../../../shared/dates';
import type { Fact } from './memory';
import type { Plan } from './plan';
import type { DailyBriefing, WeeklyReview } from './proactive';

export interface Bubble {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** What the assistant changed in the app ("Added Milk to the shopping list.") */
  actions?: string[];
  /** A plan the assistant proposed, applied only when the user taps Apply */
  plan?: Plan;
  error?: boolean;
}

export interface Chat {
  /** A new chat starts each day, since each turn carries that day's data */
  date: string;
  /** What's sent to Claude: only ever appended to, never edited */
  history: BetaMessageParam[];
  /** What's shown on screen */
  bubbles: Bubble[];
  speak: boolean;
  /** Things that happened outside the chat (an applied plan), told to the assistant with the next question */
  notes?: string[];
}

const KEY = 'assistant:v1';

export const newChat = (speak = false): Chat => ({ date: toDateKey(), history: [], bubbles: [], speak });

export async function loadChat(): Promise<Chat> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return newChat();
    const chat = JSON.parse(raw) as Chat;
    return chat.date === toDateKey() ? chat : newChat(chat.speak);
  } catch {
    return newChat();
  }
}

export async function saveChat(chat: Chat): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(chat));
}

const MEMORY_KEY = 'assistant:memory:v1';

/** Remembered facts outlive the daily chat. */
export async function loadMemory(): Promise<Fact[]> {
  try {
    const raw = await AsyncStorage.getItem(MEMORY_KEY);
    return raw ? (JSON.parse(raw) as Fact[]) : [];
  } catch {
    return [];
  }
}

export async function saveMemory(facts: Fact[]): Promise<void> {
  await AsyncStorage.setItem(MEMORY_KEY, JSON.stringify(facts));
}

const PROACTIVE_KEY = 'assistant:proactive:v1';

export interface Proactive {
  /** The latest daily briefings, newest last (today's, and tomorrow's from the evening before) */
  briefings: DailyBriefing[];
  review: WeeklyReview | null;
}

export async function loadProactive(): Promise<Proactive> {
  try {
    const raw = await AsyncStorage.getItem(PROACTIVE_KEY);
    return raw ? (JSON.parse(raw) as Proactive) : { briefings: [], review: null };
  } catch {
    return { briefings: [], review: null };
  }
}

export async function saveProactive(p: Proactive): Promise<void> {
  await AsyncStorage.setItem(PROACTIVE_KEY, JSON.stringify({ ...p, briefings: p.briefings.slice(-3) }));
}

export const bubble = (role: Bubble['role'], text: string, extra: Partial<Bubble> = {}): Bubble => ({ id: newId(), role, text, ...extra });

/** Starting points that show off what the assistant can connect. */
export const SUGGESTIONS = [
  'Plan my day',
  'What should I eat before the gym?',
  'What can I cook tonight?',
  'I have 20 minutes, what should I do?',
  'How is my budget looking?',
  'Plan my week',
  'Make a meal plan for this week',
  'I finished the milk and the eggs',
  'What should I wear today?',
  'What do you remember about me?',
];
