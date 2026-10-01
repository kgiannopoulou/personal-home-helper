import { newId } from '../../../shared/dates';
import { categorize } from '../../../shared/homeCore';
import type { Room, Supply, Task } from './types';

type Seed = [name: string, everyDays: number, minutes: number];

const ROOMS: { name: string; emoji: string; personal?: boolean; tasks: Seed[] }[] = [
  {
    name: 'Kitchen',
    emoji: '🍳',
    tasks: [
      ['Wash dishes', 1, 15],
      ['Wipe kitchen counters', 1, 5],
      ['Take out rubbish', 3, 3],
      ['Clean kitchen', 7, 20],
      ['Deep clean fridge', 30, 30],
      ['Clean oven', 30, 30],
    ],
  },
  {
    name: 'Bathroom',
    emoji: '🚿',
    tasks: [
      ['Clean toilet', 7, 10],
      ['Clean shower', 7, 15],
      ['Clean mirror', 7, 3],
      ['Mop bathroom floor', 7, 10],
    ],
  },
  {
    name: 'Bedroom',
    emoji: '🛏️',
    tasks: [
      ['Make bed', 1, 2],
      ['Change bedsheets', 7, 15],
      ['Dust hard-to-reach areas', 30, 20],
    ],
  },
  {
    name: 'Living room',
    emoji: '🛋️',
    tasks: [
      ['Tidy up', 1, 5],
      ['Vacuum', 7, 20],
      ['Mop floors', 7, 20],
      ['Clean windows', 30, 30],
    ],
  },
  {
    name: 'Laundry',
    emoji: '🧺',
    tasks: [
      ['Do laundry', 3, 10],
      ['Clean washing machine', 30, 15],
    ],
  },
  {
    name: 'Maintenance',
    emoji: '🔧',
    tasks: [
      ['Descale coffee machine', 60, 10],
      ['Clean washing-machine filter', 60, 10],
      ['Change air-conditioner filter', 90, 15],
      ['Check smoke detectors', 180, 5],
      ['Replace water filter', 60, 5],
    ],
  },
  {
    name: 'Me',
    emoji: '🧴',
    personal: true,
    tasks: [
      ['Skincare routine', 1, 10],
      ['Water plants', 3, 5],
    ],
  },
];

const SUPPLIES = [
  'Dish soap',
  'Sponges',
  'Laundry detergent',
  'Fabric softener',
  'Kitchen cleaner',
  'Bathroom cleaner',
  'Toilet cleaner',
  'Trash bags',
  'Paper towels',
  'Toilet paper',
];

export function defaultHome(): { rooms: Room[]; tasks: Task[]; supplies: Supply[] } {
  const rooms: Room[] = [];
  const tasks: Task[] = [];
  for (const r of ROOMS) {
    const room: Room = { id: newId(), name: r.name, emoji: r.emoji, ...(r.personal ? { personal: true } : {}) };
    rooms.push(room);
    for (const [name, everyDays, minutes] of r.tasks) tasks.push({ id: newId(), name, roomId: room.id, everyDays, minutes });
  }
  const supplies: Supply[] = SUPPLIES.map((name) => ({ id: newId(), name, category: categorize(name), level: 'full' }));
  return { rooms, tasks, supplies };
}
