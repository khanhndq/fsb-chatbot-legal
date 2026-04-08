import {
  applyLegalSearchStrategy,
  getMaxToolCallsForStrategy,
  INSURANCE_HYBRID_TOP_K,
  INSURANCE_LAW_ONLY_TOP_K,
  inferLegalSearchStrategy,
  HYBRID_TOP_K,
  LAW_ONLY_TOP_K,
} from './legal-search-policy';

describe('legal-search-policy', () => {
  it('uses law_only for direct legal definition questions', () => {
    expect(inferLegalSearchStrategy('Hợp đồng lao động là gì?')).toBe('law_only');
  });

  it('uses hybrid for dispute-style questions', () => {
    expect(
      inferLegalSearchStrategy('Nếu công ty sa thải trái luật tôi có thể kiện không?'),
    ).toBe('hybrid');
  });

  it('uses hybrid when the user explicitly asks for precedents', () => {
    expect(inferLegalSearchStrategy('Có án lệ nào liên quan không?')).toBe('hybrid');
  });

  it('forces the first search_legal call to use law source for law_only strategy', () => {
    expect(
      applyLegalSearchStrategy(
        'search_legal',
        { query: 'Hợp đồng lao động là gì?' },
        'law_only',
        true,
      ),
    ).toEqual({
      query: 'Hợp đồng lao động là gì?',
      source_type: 'law',
      top_k: LAW_ONLY_TOP_K,
    });
  });

  it('defaults law_only searches to a narrower top_k even after the first call', () => {
    expect(
      applyLegalSearchStrategy(
        'search_legal',
        { query: 'Mức đóng bảo hiểm xã hội là bao nhiêu?' },
        'law_only',
        false,
      ),
    ).toEqual({
      query: 'Mức đóng bảo hiểm xã hội là bao nhiêu? mức hưởng cách tính',
      original_query: 'Mức đóng bảo hiểm xã hội là bao nhiêu?',
      top_k: INSURANCE_LAW_ONLY_TOP_K,
    });
  });

  it('defaults hybrid searches to a broader top_k', () => {
    expect(
      applyLegalSearchStrategy(
        'search_legal',
        { query: 'Nếu công ty sa thải trái luật tôi có thể kiện không?' },
        'hybrid',
        true,
      ),
    ).toEqual({
      query: 'Nếu công ty sa thải trái luật tôi có thể kiện không?',
      top_k: HYBRID_TOP_K,
    });
  });

  it('uses domain-specific top_k for health insurance lookup questions', () => {
    expect(
      applyLegalSearchStrategy(
        'search_legal',
        { query: 'Thẻ BHYT có được thanh toán trái tuyến không?' },
        'law_only',
        true,
      ),
    ).toEqual({
      query: 'Thẻ BHYT có được thanh toán trái tuyến không? bảo hiểm y tế điều kiện đối tượng',
      original_query: 'Thẻ BHYT có được thanh toán trái tuyến không?',
      source_type: 'law',
      top_k: INSURANCE_LAW_ONLY_TOP_K,
    });
  });

  it('uses domain-specific top_k for social insurance hybrid questions', () => {
    expect(
      applyLegalSearchStrategy(
        'search_legal',
        { query: 'Nếu bị từ chối hưởng BHXH một lần thì có thể khiếu nại không?' },
        'hybrid',
        true,
      ),
    ).toEqual({
      query: 'Nếu bị từ chối hưởng BHXH một lần thì có thể khiếu nại không? bảo hiểm xã hội chế độ điều kiện',
      original_query: 'Nếu bị từ chối hưởng BHXH một lần thì có thể khiếu nại không?',
      top_k: INSURANCE_HYBRID_TOP_K,
    });
  });

  it('uses fewer tool calls for law_only than hybrid', () => {
    expect(getMaxToolCallsForStrategy('law_only')).toBe(1);
    expect(getMaxToolCallsForStrategy('hybrid')).toBe(2);
    expect(getMaxToolCallsForStrategy()).toBe(1);
  });
});
