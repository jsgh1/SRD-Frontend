export type MessageReceipt = {
  id: string;
  delivered_at: string | null;
  read_at: string | null;
};

type SequencedMessage = MessageReceipt & { sequence: number };

export function withReceipt<T extends MessageReceipt>(message: T, receipt?: MessageReceipt): T {
  return receipt ? {
    ...message,
    delivered_at: message.delivered_at ?? receipt.delivered_at,
    read_at: message.read_at ?? receipt.read_at,
  } : message;
}

export function mergeMessages<T extends SequencedMessage>(current: T[], incoming: T[]): T[] {
  const byId = new Map(current.map(message => [message.id, message]));
  for (const message of incoming) {
    const previous = byId.get(message.id);
    byId.set(message.id, previous ? withReceipt({ ...previous, ...message }, previous) : message);
  }
  return [...byId.values()].sort((a, b) => a.sequence - b.sequence);
}

export function mergeReceipts<T extends MessageReceipt>(current: T[], receipts: MessageReceipt[]): T[] {
  const byId = new Map(receipts.map(receipt => [receipt.id, receipt]));
  return current.map(message => withReceipt(message, byId.get(message.id)));
}
