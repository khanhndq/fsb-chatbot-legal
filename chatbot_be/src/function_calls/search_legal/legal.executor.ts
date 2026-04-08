import { LLMToolExecutor as ToolExecutor } from "../../providers/types";
import {
  RetrievedDocument,
  retrieveHybrid,
} from "../../retrieval";
import {
  extractLegalFocusTerms,
  inferLegalQuestionProfile,
} from "../../services/legal-question-policy";
import { HYBRID_TOP_K, LAW_ONLY_TOP_K } from "../../services/legal-search-policy";

function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim();
}

function trimEvidenceText(text: string, maxLength: number = 700): string {
  if (text.length <= maxLength) {
    return text;
  }

  const candidate = text.slice(0, maxLength + 80);
  const lastBoundary = Math.max(
    candidate.lastIndexOf(". "),
    candidate.lastIndexOf("; "),
    candidate.lastIndexOf("\n"),
  );

  if (lastBoundary >= Math.floor(maxLength * 0.6)) {
    return `${candidate.slice(0, lastBoundary + 1).trim()} ...`;
  }

  return `${text.slice(0, maxLength).trim()} ...`;
}

function getEvidenceIdentity(r: RetrievedDocument): string {
  return [
    r.sourceType,
    r.documentName,
    r.article || "",
    r.section || "",
    r.question || "",
  ].join("::");
}

function getFocusMatchCount(text: string, focusTerms: string[]): number {
  if (focusTerms.length === 0) {
    return 0;
  }

  const normalizedText = normalizeText(text);
  return focusTerms.reduce(
    (count, term) => count + (normalizedText.includes(term) ? 1 : 0),
    0,
  );
}

function getEvidenceCaps(
  query: string,
  sourceType?: "law" | "precedent" | "faq",
): { rag: number; cbr: number } {
  const profile = inferLegalQuestionProfile(query);

  if (sourceType === "precedent") {
    return { rag: 0, cbr: profile.intent === "comparison" || profile.intent === "scenario" ? 2 : 1 };
  }

  if (sourceType === "law" || sourceType === "faq") {
    if (profile.domain === "health_insurance" || profile.domain === "social_insurance") {
      return { rag: 3, cbr: 0 };
    }

    if (profile.intent === "definition" || profile.intent === "rate" || profile.intent === "deadline") {
      return { rag: 2, cbr: 0 };
    }

    return { rag: 3, cbr: 0 };
  }

  if (profile.domain === "health_insurance" || profile.domain === "social_insurance") {
    return { rag: 3, cbr: 1 };
  }

  if (profile.intent === "comparison" || profile.intent === "scenario") {
    return { rag: 3, cbr: 2 };
  }

  return { rag: 2, cbr: 1 };
}

function selectEvidence(
  results: RetrievedDocument[],
  focusTerms: string[],
  limit: number,
): RetrievedDocument[] {
  if (limit <= 0) {
    return [];
  }

  const ranked = [...results].sort((left, right) => {
    const rightFocus = getFocusMatchCount(right.text, focusTerms);
    const leftFocus = getFocusMatchCount(left.text, focusTerms);

    if (rightFocus !== leftFocus) {
      return rightFocus - leftFocus;
    }

    return right.score - left.score;
  });

  const selected: RetrievedDocument[] = [];
  const seen = new Set<string>();

  for (const result of ranked) {
    const identity = getEvidenceIdentity(result);
    if (seen.has(identity)) {
      continue;
    }

    seen.add(identity);
    selected.push(result);
    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

/**
 * Format a single result for the LLM response.
 */
function formatResult(r: RetrievedDocument, rank: number): Record<string, unknown> {
  const base: Record<string, unknown> = {
    source_type: r.sourceType,
    document_name: r.documentName,
    score: Math.round(r.score * 1000) / 1000,
    rank,
    text: trimEvidenceText(r.text),
  };

  // Add source-specific metadata
  if (r.article) base.article = r.article;
  if (r.articleTitle) base.article_title = r.articleTitle;
  if (r.chapter) base.chapter = r.chapter;
  if (r.documentTitle) base.document_title = r.documentTitle;
  if (r.caseNumber) base.case_number = r.caseNumber;
  if (r.court) base.court = r.court;
  if (r.caseType) base.case_type = r.caseType;
  if (r.section) base.section = r.section;
  if (r.question) base.question = r.question;
  if (r.link) base.link = r.link;

  // Construct link for precedents from document_name if no explicit link
  if (!base.link && r.sourceType === "precedent" && r.documentName) {
    const docPrefix = r.documentName.split("_")[0];
    base.link = `https://anle.toaan.gov.vn/webcenter/ShowProperty?nodeId=/UCMServer/${docPrefix}`;
  }

  return base;
}

// ═══════════════════════════════════════════════════════════════════════
//  CBR + RAG Combined Search Strategy
// ═══════════════════════════════════════════════════════════════════════

/**
 * Phase 1 — RAG: Search laws and FAQ for relevant legal provisions.
 * Returns factual legal text as ground truth.
 */
async function searchLegalCBRRAG(
  query: string,
  sourceType?: "law" | "precedent" | "faq",
  topK: number = HYBRID_TOP_K,
): Promise<{
  rag_results: RetrievedDocument[];
  cbr_results: RetrievedDocument[];
  total: number;
}> {
  const { lawResults, precedentResults, total } = await retrieveHybrid(query, {
    topK,
    sourceType,
  });
  console.log("RAG results: ", lawResults);
  console.log("CBR results: ", precedentResults);
  return {
    rag_results: lawResults,
    cbr_results: precedentResults,
    total,
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  Tool Executor
// ═══════════════════════════════════════════════════════════════════════

/**
 * Tool executor for search_legal — called by the OpenAI function calling system.
 *
 * Returns structured results with two sections:
 *   - legal_provisions (RAG): Relevant law articles and FAQ answers
 *   - case_precedents (CBR): Similar court cases with reasoning
 */
export const legalToolExecutor: ToolExecutor = async (
  name: string,
  args: Record<string, unknown>,
): Promise<string> => {
  if (name === "search_legal") {
    const query = args.query as string;
    const originalQuery = (args.original_query as string) || query;
    const sourceType = args.source_type as "law" | "precedent" | "faq" | undefined;
    const defaultTopK = sourceType === "law" || sourceType === "faq"
      ? LAW_ONLY_TOP_K
      : HYBRID_TOP_K;
    const topK = (args.top_k as number) || defaultTopK;

    console.log(
      `🔍 [CBR+RAG] Searching legal KB for: "${query}"` +
      (sourceType ? ` [filter: ${sourceType}]` : "") +
      ` [top_k: ${topK}]`,
    );

    try {
      const { rag_results, cbr_results, total } = await searchLegalCBRRAG(
        query,
        sourceType,
        topK,
      );
      const focusTerms = extractLegalFocusTerms(originalQuery);
      const profile = inferLegalQuestionProfile(originalQuery);
      const evidenceCaps = getEvidenceCaps(originalQuery, sourceType);
      const selectedRagResults = selectEvidence(
        rag_results,
        focusTerms,
        evidenceCaps.rag,
      );
      const selectedCbrResults = selectEvidence(
        cbr_results,
        focusTerms,
        evidenceCaps.cbr,
      );

      if (total === 0) {
        return JSON.stringify({
          found: false,
          message: "Không tìm thấy tài liệu pháp luật liên quan.",
          suggestion:
            "Thử diễn đạt lại câu hỏi hoặc sử dụng thuật ngữ pháp lý khác.",
        });
      }

      const response: Record<string, unknown> = {
        found: true,
        strategy: "CBR+RAG",
        answer_focus: {
          intent: profile.intent,
          domain: profile.domain,
          original_query: originalQuery,
          rewritten_query: query,
          focus_terms: focusTerms,
          instruction:
            "Ưu tiên dùng các kết quả theo đúng thứ tự rank. Chỉ dùng kết quả sau để bổ sung điều kiện còn thiếu, không gộp mọi chi tiết nếu không cần cho câu hỏi.",
        },
      };

      // RAG section: legal provisions
      if (selectedRagResults.length > 0) {
        response.legal_provisions = {
          description: "Các điều luật và quy định pháp luật liên quan đã được rút gọn theo mức độ phù hợp (RAG)",
          count: selectedRagResults.length,
          retrieved_count: rag_results.length,
          results: selectedRagResults.map((result, index) => formatResult(result, index + 1)),
        };
      }

      // CBR section: case precedents
      if (selectedCbrResults.length > 0) {
        response.case_precedents = {
          description: "Các bản án và án lệ tương tự đã được rút gọn theo mức độ phù hợp (CBR)",
          count: selectedCbrResults.length,
          retrieved_count: cbr_results.length,
          results: selectedCbrResults.map((result, index) => formatResult(result, index + 1)),
        };
      }

      return JSON.stringify(response);
    } catch (error) {
      console.error("❌ search_legal error:", error);
      return JSON.stringify({
        found: false,
        message: "Đã xảy ra lỗi khi tra cứu cơ sở dữ liệu pháp luật.",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw new Error(`Unknown tool: ${name}`);
};
