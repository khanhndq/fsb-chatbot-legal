import {
  buildLegalAnswerPolicyPrompt,
  extractLegalFocusTerms,
  inferLegalDomain,
  inferLegalQuestionIntent,
  inferLegalQuestionProfile,
  rewriteLegalSearchQuery,
} from './legal-question-policy';

describe('legal-question-policy', () => {
  it('infers definition intent for direct concept questions', () => {
    expect(inferLegalQuestionIntent('Hợp đồng lao động là gì?')).toBe('definition');
  });

  it('infers procedure intent for filing-style questions', () => {
    expect(inferLegalQuestionIntent('Thủ tục cấp lại thẻ BHYT như thế nào?')).toBe('procedure');
  });

  it('infers insurance domains from common abbreviations', () => {
    expect(inferLegalDomain('Thẻ BHYT có được thanh toán trái tuyến không?')).toBe('health_insurance');
    expect(inferLegalDomain('Điều kiện hưởng BHXH một lần là gì?')).toBe('social_insurance');
  });

  it('builds a profile with both intent and domain', () => {
    expect(
      inferLegalQuestionProfile('Điều kiện hưởng BHXH một lần là gì?'),
    ).toEqual({
      intent: 'eligibility',
      domain: 'social_insurance',
    });
  });

  it('builds an answer policy prompt that includes detected intent and domain guidance', () => {
    const prompt = buildLegalAnswerPolicyPrompt('Thủ tục cấp lại thẻ BHYT như thế nào?');

    expect(prompt).toContain('Detected intent: procedure');
    expect(prompt).toContain('Detected domain: health_insurance');
    expect(prompt).toContain('Answer as a short ordered list of steps or required documents.');
  });

  it('rewrites insurance queries with missing focus terms', () => {
    expect(rewriteLegalSearchQuery('Thủ tục cấp lại thẻ BHYT như thế nào?')).toContain('hồ sơ');
    expect(rewriteLegalSearchQuery('Điều kiện hưởng BHXH một lần là gì?')).toContain('thời gian đóng');
  });

  it('extracts useful focus terms from rewritten insurance queries', () => {
    expect(extractLegalFocusTerms('Điều kiện hưởng BHXH một lần là gì?')).toEqual(
      expect.arrayContaining(['dieu', 'kien', 'bhxh', 'thoi', 'gian', 'dong']),
    );
  });
});
