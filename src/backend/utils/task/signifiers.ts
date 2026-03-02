export const EMOJI_SIGNIFIERS = {
  due: '📅',
  scheduled: '⏳',
  start: '🛫',
  created: '➕',
  done: '✅',
  cancelled: '❌',
  recurrence: '🔁',
  onCompletion: '🏁',
  id: '🆔',
  dependsOn: '⛔',
  priority: {
    highest: '🔺',
    high: '⏫',
    medium: '🔼',
    low: '🔽',
    lowest: '⏬',
  },
} as const;

export const TEXT_SIGNIFIERS = {
  due: '[due::',
  scheduled: '[scheduled::',
  start: '[start::',
  created: '[created::',
  done: '[done::',
  cancelled: '[cancelled::',
  recurrence: '[repeat::',
  onCompletion: '[onCompletion::',
  id: '[id::',
  dependsOn: '[dependsOn::',
  priority: '[priority::',
} as const;

export type TaskFormat = 'emoji' | 'text';

export const PRIORITY_ORDER: Record<string, number> = {
  highest: 1,
  high: 2,
  medium: 3,
  normal: 4,
  low: 5,
  lowest: 6,
};

export function getPriorityEmoji(priority: string): string | undefined {
  const validPriorities = ['highest', 'high', 'medium', 'low', 'lowest'] as const;
  if (!(validPriorities as readonly string[]).includes(priority)) {
    return undefined;
  }
  return EMOJI_SIGNIFIERS.priority[priority as keyof typeof EMOJI_SIGNIFIERS.priority];
}

export function getPriorityFromEmoji(emoji: string): string | undefined {
  for (const [name, e] of Object.entries(EMOJI_SIGNIFIERS.priority)) {
    if (e === emoji) return name;
  }
  return undefined;
}
