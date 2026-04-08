export type LegalQuestionIntent =
  | 'definition'
  | 'eligibility'
  | 'procedure'
  | 'rate'
  | 'deadline'
  | 'comparison'
  | 'scenario';

export type LegalDomain =
  | 'labor_law'
  | 'social_insurance'
  | 'health_insurance'
  | 'tax_law'
  | 'civil_enterprise_law'
  | 'other';

export interface LegalQuestionProfile {
  intent: LegalQuestionIntent;
  domain: LegalDomain;
}

interface QueryRewritePlan {
  requiredTerms: string[];
  focusTerms: string[];
}

const DOMAIN_PATTERNS: Array<[LegalDomain, RegExp[]]> = [
  [
    'health_insurance',
    [
      /\bbhyt\b/,
      /\bbao hiem y te\b/,
      /\bthe bhyt\b/,
      /\bkham chua benh\b/,
      /\bvien phi\b/,
      /\bthong tuyen\b/,
    ],
  ],
  [
    'social_insurance',
    [
      /\bbhxh\b/,
      /\bbao hiem xa hoi\b/,
      /\bom dau\b/,
      /\bthai san\b/,
      /\bhuu tri\b/,
      /\btuat\b/,
      /\bthat nghiep\b/,
      /\btro cap mot lan\b/,
    ],
  ],
  [
    'labor_law',
    [
      /\bhop dong lao dong\b/,
      /\bnguoi lao dong\b/,
      /\bnguoi su dung lao dong\b/,
      /\btien luong\b/,
      /\blam them\b/,
      /\bnghi phep\b/,
      /\bsa thai\b/,
      /\bky luat lao dong\b/,
      /\bcham dut hop dong\b/,
    ],
  ],
  [
    'tax_law',
    [
      /\bthue\b/,
      /\bvat\b/,
      /\bgtgt\b/,
      /\btncn\b/,
      /\btndn\b/,
      /\bhoa don\b/,
      /\bquyet toan\b/,
    ],
  ],
  [
    'civil_enterprise_law',
    [
      /\bdoanh nghiep\b/,
      /\bcong ty\b/,
      /\bdang ky kinh doanh\b/,
      /\bgiay phep\b/,
      /\bco dong\b/,
      /\bvon dieu le\b/,
      /\bthua ke\b/,
      /\bhop dong dan su\b/,
      /\btrach nhiem huu han\b/,
    ],
  ],
];

const INTENT_PATTERNS: Array<[LegalQuestionIntent, RegExp[]]> = [
  [
    'comparison',
    [
      /\bso sanh\b/,
      /\bphan biet\b/,
      /\bkhac nhau\b/,
      /\bgiong nhau\b/,
    ],
  ],
  [
    'procedure',
    [
      /\bthu tuc\b/,
      /\bho so\b/,
      /\bquy trinh\b/,
      /\bcac buoc\b/,
      /\blam the nao\b/,
      /\blam sao\b/,
      /\bnop o dau\b/,
      /\bdang ky\b/,
      /\bcap lai\b/,
    ],
  ],
  [
    'deadline',
    [
      /\bthoi han\b/,
      /\bhan chot\b/,
      /\bhan cuoi\b/,
      /\bbao lau\b/,
      /\bkhi nao\b/,
      /\btrong bao nhieu ngay\b/,
    ],
  ],
  [
    'rate',
    [
      /\bbao nhieu\b/,
      /\bmuc dong\b/,
      /\bmuc huong\b/,
      /\bti le\b/,
      /\bty le\b/,
      /\bphan tram\b/,
      /\bcach tinh\b/,
      /\bmuc phat\b/,
      /\btien luong lam them\b/,
    ],
  ],
  [
    'eligibility',
    [
      /\bdieu kien\b/,
      /\bduoc huong\b/,
      /\bco duoc\b/,
      /\bdoi tuong nao\b/,
      /\btruong hop nao\b/,
      /\bai duoc\b/,
      /\byeu cau nao\b/,
    ],
  ],
  [
    'definition',
    [
      /\bla gi\b/,
      /\bkhai niem\b/,
      /\bnghia la gi\b/,
      /\bhieu nhu the nao\b/,
      /\bduoc quy dinh nhu the nao\b/,
    ],
  ],
];

function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

function buildInsuranceRewritePlan(profile: LegalQuestionProfile): QueryRewritePlan | null {
  if (profile.domain === 'health_insurance') {
    switch (profile.intent) {
      case 'procedure':
        return {
          requiredTerms: ['bảo hiểm y tế'],
          focusTerms: ['thủ tục', 'hồ sơ'],
        };
      case 'eligibility':
        return {
          requiredTerms: ['bảo hiểm y tế'],
          focusTerms: ['điều kiện', 'đối tượng'],
        };
      case 'rate':
        return {
          requiredTerms: ['bảo hiểm y tế'],
          focusTerms: ['mức hưởng', 'tỷ lệ thanh toán'],
        };
      case 'deadline':
        return {
          requiredTerms: ['bảo hiểm y tế'],
          focusTerms: ['thời hạn'],
        };
      case 'comparison':
        return {
          requiredTerms: ['bảo hiểm y tế'],
          focusTerms: ['so sánh', 'quyền lợi'],
        };
      case 'scenario':
        return {
          requiredTerms: ['bảo hiểm y tế'],
          focusTerms: ['quyền lợi', 'điều kiện'],
        };
      case 'definition':
      default:
        return {
          requiredTerms: ['bảo hiểm y tế'],
          focusTerms: [],
        };
    }
  }

  if (profile.domain === 'social_insurance') {
    switch (profile.intent) {
      case 'procedure':
        return {
          requiredTerms: ['bảo hiểm xã hội'],
          focusTerms: ['thủ tục', 'hồ sơ'],
        };
      case 'eligibility':
        return {
          requiredTerms: ['bảo hiểm xã hội'],
          focusTerms: ['điều kiện', 'thời gian đóng'],
        };
      case 'rate':
        return {
          requiredTerms: ['bảo hiểm xã hội'],
          focusTerms: ['mức hưởng', 'cách tính'],
        };
      case 'deadline':
        return {
          requiredTerms: ['bảo hiểm xã hội'],
          focusTerms: ['thời hạn'],
        };
      case 'comparison':
        return {
          requiredTerms: ['bảo hiểm xã hội'],
          focusTerms: ['so sánh', 'chế độ'],
        };
      case 'scenario':
        return {
          requiredTerms: ['bảo hiểm xã hội'],
          focusTerms: ['chế độ', 'điều kiện'],
        };
      case 'definition':
      default:
        return {
          requiredTerms: ['bảo hiểm xã hội'],
          focusTerms: [],
        };
    }
  }

  return null;
}

export function inferLegalDomain(userMessage: string): LegalDomain {
  const normalized = normalizeText(userMessage);

  for (const [domain, patterns] of DOMAIN_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(normalized))) {
      return domain;
    }
  }

  return 'other';
}

export function inferLegalQuestionIntent(userMessage: string): LegalQuestionIntent {
  const normalized = normalizeText(userMessage);

  for (const [intent, patterns] of INTENT_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(normalized))) {
      return intent;
    }
  }

  return 'scenario';
}

export function inferLegalQuestionProfile(userMessage: string): LegalQuestionProfile {
  return {
    intent: inferLegalQuestionIntent(userMessage),
    domain: inferLegalDomain(userMessage),
  };
}

export function rewriteLegalSearchQuery(userMessage: string): string {
  const profile = inferLegalQuestionProfile(userMessage);
  const rewritePlan = buildInsuranceRewritePlan(profile);

  if (!rewritePlan) {
    return userMessage;
  }

  const normalizedQuery = normalizeText(userMessage);
  const missingTerms = [...rewritePlan.requiredTerms, ...rewritePlan.focusTerms].filter(
    (term) => !normalizedQuery.includes(normalizeText(term)),
  );

  if (missingTerms.length === 0) {
    return userMessage;
  }

  return `${userMessage} ${missingTerms.join(' ')}`.trim();
}

export function extractLegalFocusTerms(userMessage: string): string[] {
  const rewrittenQuery = rewriteLegalSearchQuery(userMessage);
  const normalized = normalizeText(rewrittenQuery);
  const stopWords = new Set([
    'la',
    'gi',
    'nhu',
    'the',
    'nao',
    'duoc',
    'theo',
    'cua',
    'cho',
    'voi',
    'khi',
    'neu',
    'mot',
    'lan',
    'bao',
    'nhieu',
    'co',
    'khong',
    'va',
    'trong',
    'tu',
    'den',
    'ngay',
    'nay',
    've',
    'quy',
    'dinh',
  ]);

  return Array.from(
    new Set(
      normalized
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3 && !stopWords.has(token)),
    ),
  );
}

function getIntentInstructions(intent: LegalQuestionIntent): string[] {
  switch (intent) {
    case 'definition':
      return [
        'Answer with one short paragraph of 1-2 sentences.',
        'Define the legal concept directly and do not add procedure, deadlines, or benefit levels unless they are essential to avoid a wrong answer.',
      ];
    case 'eligibility':
      return [
        'Answer with the required conditions and the main exclusions only.',
        'Do not add extra background beyond what affects eligibility.',
      ];
    case 'procedure':
      return [
        'Answer as a short ordered list of steps or required documents.',
        'Do not add broad legal theory or unrelated benefit descriptions.',
      ];
    case 'rate':
      return [
        'Answer with the amount, rate, bracket, or calculation basis only.',
        'Use a compact table when multiple rates or thresholds exist.',
      ];
    case 'deadline':
      return [
        'Answer with the deadline, when the clock starts, and the main consequence of missing it if the retrieved text supports that.',
        'Avoid unrelated procedure details.',
      ];
    case 'comparison':
      return [
        'Answer in a short comparison table or two concise bullet points.',
        'Only compare the dimensions implied by the user question.',
      ];
    case 'scenario':
    default:
      return [
        'Apply the retrieved rules to the facts given by the user.',
        'Separate supported conclusions from assumptions, and say clearly if the facts are insufficient.',
      ];
  }
}

function getDomainInstructions(domain: LegalDomain): string[] {
  switch (domain) {
    case 'health_insurance':
      return [
        'For health insurance questions, prioritize coverage scope, payment level, route conditions, and exceptions that change reimbursement.',
      ];
    case 'social_insurance':
      return [
        'For social insurance questions, prioritize contribution duration, qualifying conditions, and the specific benefit type before giving a conclusion.',
      ];
    default:
      return [];
  }
}

export function buildLegalAnswerPolicyPrompt(userMessage: string): string {
  const profile = inferLegalQuestionProfile(userMessage);
  const instructions = [
    'Legal Answer Shaping Policy',
    `Detected intent: ${profile.intent}`,
    `Detected domain: ${profile.domain}`,
    '',
    'Follow these answer-shaping rules after retrieval:',
    '- Answer only the primary user intent.',
    '- Put the direct answer first and keep the response as short as possible while remaining correct.',
    '- Do not add practical notes, exceptions, or adjacent issues unless they materially change the answer.',
    '- If the retrieved text does not support a claim, omit that claim.',
    ...getIntentInstructions(profile.intent).map((line) => `- ${line}`),
    ...getDomainInstructions(profile.domain).map((line) => `- ${line}`),
  ];

  return instructions.join('\n');
}
