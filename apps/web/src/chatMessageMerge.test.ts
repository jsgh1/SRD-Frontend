import { describe, expect, it } from 'vitest';
import { mergeMessages, mergeReceipts } from './chatMessageMerge';

type TestMessage = {
  id: string;
  sequence: number;
  body: string;
  delivered_at: string | null;
  read_at: string | null;
};

const message = (id: string, sequence: number, body: string, delivered_at: string | null = null, read_at: string | null = null): TestMessage => ({
  id, sequence, body, delivered_at, read_at,
});

describe('chat message merging', () => {
  it('updates duplicate messages once and keeps them ordered by sequence', () => {
    const current = [message('later', 4, 'old later'), message('first', 1, 'first')];
    const incoming = [message('later', 4, 'new later'), message('middle', 2, 'middle')];

    expect(mergeMessages(current, incoming)).toEqual([
      message('first', 1, 'first'),
      message('middle', 2, 'middle'),
      message('later', 4, 'new later'),
    ]);
  });

  it('preserves an existing receipt when a duplicate arrives without receipt timestamps', () => {
    const delivered = '2026-11-02T12:00:00Z';
    const read = '2026-11-02T12:01:00Z';

    expect(mergeMessages(
      [message('one', 1, 'before', delivered, read)],
      [message('one', 1, 'after')],
    )).toEqual([message('one', 1, 'after', delivered, read)]);
  });

  it('applies receipt updates only to matching messages and leaves other rows intact', () => {
    const current = [message('one', 1, 'one'), message('two', 2, 'two')];
    const receipts = [{ id: 'two', delivered_at: '2026-11-02T12:00:00Z', read_at: null }];

    expect(mergeReceipts(current, receipts)).toEqual([
      message('one', 1, 'one'),
      message('two', 2, 'two', '2026-11-02T12:00:00Z'),
    ]);
  });
});
