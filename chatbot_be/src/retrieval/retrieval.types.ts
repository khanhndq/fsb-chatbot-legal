export type RetrievalSourceType = "law" | "precedent" | "faq";

export type RetrievalMetadataValue = string | number | boolean;

export type RetrievalMetadata = Record<string, RetrievalMetadataValue>;

export interface RetrievedDocument {
  id: string;
  score: number;
  sourceType: RetrievalSourceType;
  text: string;
  documentName: string;
  article?: string;
  articleTitle?: string;
  chapter?: string;
  documentTitle?: string;
  caseNumber?: string;
  court?: string;
  caseType?: string;
  section?: string;
  question?: string;
  link?: string;
  metadata: RetrievalMetadata;
}

export interface RetrieveLawOptions {
  topK?: number;
  sourceTypes?: Array<Extract<RetrievalSourceType, "law" | "faq">>;
}

export interface RetrievePrecedentOptions {
  topK?: number;
}

export interface HybridRetrieveOptions {
  topK?: number;
  sourceType?: RetrievalSourceType;
  lawTopK?: number;
  precedentTopK?: number;
}

export interface HybridRetrieveResult {
  lawResults: RetrievedDocument[];
  precedentResults: RetrievedDocument[];
  total: number;
}
