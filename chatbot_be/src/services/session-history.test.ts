import {
  appendConversationTurn,
  normalizeSessionContext,
  trimConversationHistory,
} from './session-history';

describe('session-history', () => {
  it('converts legacy string context into user-only history safely', () => {
    expect(normalizeSessionContext(['Câu hỏi cũ', 'Câu hỏi tiếp theo'])).toEqual([
      { role: 'user', content: 'Câu hỏi cũ' },
      { role: 'user', content: 'Câu hỏi tiếp theo' },
    ]);
  });

  it('appends a full user-assistant turn in order', () => {
    expect(appendConversationTurn([], 'Câu hỏi', 'Câu trả lời', 6)).toEqual([
      { role: 'user', content: 'Câu hỏi' },
      { role: 'assistant', content: 'Câu trả lời' },
    ]);
  });

  it('trims history without leaving an orphan assistant message at the start', () => {
    expect(
      trimConversationHistory(
        [
          { role: 'user', content: 'u1' },
          { role: 'assistant', content: 'a1' },
          { role: 'user', content: 'u2' },
          { role: 'assistant', content: 'a2' },
        ],
        3,
      ),
    ).toEqual([
      { role: 'user', content: 'u2' },
      { role: 'assistant', content: 'a2' },
    ]);
  });
});
