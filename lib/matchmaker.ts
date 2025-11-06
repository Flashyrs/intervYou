type WaitingUser = { userId: string; createdAt: number };
const queue: WaitingUser[] = [];

export function enqueue(userId: string) {
  queue.push({ userId, createdAt: Date.now() });
}

export function tryMatch(): [string, string] | null {
  if (queue.length >= 2) {
    const a = queue.shift()!;
    const b = queue.shift()!;
    return [a.userId, b.userId];
  }
  return null;
}
