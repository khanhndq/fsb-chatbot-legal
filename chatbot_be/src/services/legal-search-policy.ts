import { inferLegalDomain, rewriteLegalSearchQuery } from './legal-question-policy';

export type LegalSearchStrategy = 'law_only' | 'hybrid';

export const LAW_ONLY_TOP_K = 3;
export const HYBRID_TOP_K = 5;
export const LAW_ONLY_MAX_TOOL_CALLS = 1;
export const HYBRID_MAX_TOOL_CALLS = 2;
export const INSURANCE_LAW_ONLY_TOP_K = 4;
export const INSURANCE_HYBRID_TOP_K = 6;

const PRECEDENT_SIGNAL_PATTERNS: RegExp[] = [
  /\ban le\b/,
  /\bban an\b/,
  /\btoa an\b/,
  /\btoa\b/,
  /\bphien toa\b/,
  /\bphan quyet\b/,
  /\btranh chap\b/,
  /\bkhoi kien\b/,
  /\bkien\b/,
  /\bxet xu\b/,
  /\bboi thuong\b/,
  /\bneu bi\b/,
  /\btruong hop nay\b/,
  /\btinh huong\b/,
  /\bsa thai trai\b/,
  /\bdon phuong cham dut trai\b/,
];

function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

export function inferLegalSearchStrategy(userMessage: string): LegalSearchStrategy {
  const normalized = normalizeText(userMessage);

  if (!normalized) {
    return 'law_only';
  }

  return PRECEDENT_SIGNAL_PATTERNS.some((pattern) => pattern.test(normalized))
    ? 'hybrid'
    : 'law_only';
}

export function applyLegalSearchStrategy(
  toolName: string,
  args: Record<string, unknown>,
  strategy?: LegalSearchStrategy,
  isFirstSearchCall: boolean = false,
): Record<string, unknown> {
  if (toolName !== 'search_legal') {
    return args;
  }

  const hasExplicitTopK = typeof args.top_k === 'number' && Number.isFinite(args.top_k);
  const query = typeof args.query === 'string' ? args.query : '';
  const rewrittenQuery = rewriteLegalSearchQuery(query);
  const domain = inferLegalDomain(rewrittenQuery);
  const isInsuranceDomain = domain === 'health_insurance' || domain === 'social_insurance';
  const defaultTopK = strategy === 'hybrid'
    ? (isInsuranceDomain ? INSURANCE_HYBRID_TOP_K : HYBRID_TOP_K)
    : (isInsuranceDomain ? INSURANCE_LAW_ONLY_TOP_K : LAW_ONLY_TOP_K);
  const queryArgs = rewrittenQuery !== query
    ? {
      query: rewrittenQuery,
      original_query: query,
    }
    : {
      query,
    };

  if (strategy === 'law_only') {
    return {
      ...args,
      ...queryArgs,
      ...(hasExplicitTopK ? {} : { top_k: defaultTopK }),
      ...(isFirstSearchCall ? { source_type: 'law' } : {}),
    };
  }

  if (strategy === 'hybrid' && !hasExplicitTopK) {
    return {
      ...args,
      ...queryArgs,
      top_k: defaultTopK,
    };
  }

  return {
    ...args,
    ...queryArgs,
  };
}

export function getMaxToolCallsForStrategy(strategy?: LegalSearchStrategy): number {
  return strategy === 'hybrid' ? HYBRID_MAX_TOOL_CALLS : LAW_ONLY_MAX_TOOL_CALLS;
}
