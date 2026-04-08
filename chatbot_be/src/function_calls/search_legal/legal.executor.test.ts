import { legalToolExecutor } from './legal.executor';

jest.mock('../../retrieval', () => ({
  retrieveHybrid: jest.fn(),
}));

const { retrieveHybrid } = jest.requireMock('../../retrieval') as {
  retrieveHybrid: jest.Mock;
};

describe('legal.executor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns rewritten query metadata and condensed ranked evidence', async () => {
    retrieveHybrid.mockResolvedValue({
      lawResults: [
        {
          id: 'law-1',
          score: 0.92,
          sourceType: 'law',
          text: 'Điều kiện hưởng BHXH một lần bao gồm thời gian đóng bảo hiểm xã hội và các trường hợp luật định.'.repeat(20),
          documentName: 'bhxh_doc_1',
          article: '60',
          metadata: {},
        },
        {
          id: 'law-2',
          score: 0.89,
          sourceType: 'law',
          text: 'Hồ sơ hưởng BHXH một lần bao gồm tờ khai và giấy tờ liên quan.',
          documentName: 'bhxh_doc_2',
          article: '109',
          metadata: {},
        },
        {
          id: 'law-3',
          score: 0.5,
          sourceType: 'law',
          text: 'Một quy định ít liên quan hơn.',
          documentName: 'bhxh_doc_3',
          article: '10',
          metadata: {},
        },
      ],
      precedentResults: [],
      total: 3,
    });

    const raw = await legalToolExecutor('search_legal', {
      query: 'Điều kiện hưởng BHXH một lần là gì? bảo hiểm xã hội thời gian đóng',
      original_query: 'Điều kiện hưởng BHXH một lần là gì?',
      source_type: 'law',
      top_k: 4,
    });

    const result = JSON.parse(raw);

    expect(result.answer_focus).toEqual(
      expect.objectContaining({
        original_query: 'Điều kiện hưởng BHXH một lần là gì?',
        rewritten_query: 'Điều kiện hưởng BHXH một lần là gì? bảo hiểm xã hội thời gian đóng',
        domain: 'social_insurance',
        intent: 'eligibility',
      }),
    );
    expect(result.legal_provisions.retrieved_count).toBe(3);
    expect(result.legal_provisions.results).toHaveLength(3);
    expect(result.legal_provisions.results[0]).toEqual(
      expect.objectContaining({
        rank: 1,
        article: '60',
      }),
    );
    expect(result.legal_provisions.results[0].text.length).toBeLessThan(900);
  });
});
