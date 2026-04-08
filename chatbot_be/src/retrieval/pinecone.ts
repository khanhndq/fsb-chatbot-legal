import { Pinecone } from "@pinecone-database/pinecone";
import { ensureRetrievalEnv } from "./env";
import { RetrievedDocument, RetrievalMetadata } from "./retrieval.types";

let pineconeClient: Pinecone | null = null;

function getPinecone(): Pinecone {
  ensureRetrievalEnv();
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "PINECONE_API_KEY is not configured. Checked process.env and repository .env files.",
      );
    }
    pineconeClient = new Pinecone({ apiKey });
  }
  return pineconeClient;
}

export function normalizeTopK(topK: number, maxTopK: number = 10): number {
  return Math.min(Math.max(topK, 1), maxTopK);
}

export async function queryPinecone(
  vector: number[],
  topK: number,
  filter?: Record<string, unknown>,
): Promise<RetrievedDocument[]> {
  const pinecone = getPinecone();
  const indexName = process.env.PINECONE_INDEX || "chatbot-vn-legal";
  const index = pinecone.index(indexName);

  const queryResult = await index.query({
    vector,
    topK: normalizeTopK(topK),
    includeMetadata: true,
    filter,
  });

  return (queryResult.matches || []).map((match) => {
    const metadata = (match.metadata || {}) as RetrievalMetadata;

    return {
      id: match.id,
      score: match.score || 0,
      sourceType: (metadata.source_type as RetrievedDocument["sourceType"]) || "law",
      text: (metadata.text as string) || "",
      documentName: (metadata.document_name as string) || "",
      article: metadata.article as string | undefined,
      articleTitle: metadata.article_title as string | undefined,
      chapter: metadata.chapter as string | undefined,
      documentTitle: metadata.document_title as string | undefined,
      caseNumber: metadata.case_number as string | undefined,
      court: metadata.court as string | undefined,
      caseType: metadata.case_type as string | undefined,
      section: metadata.section as string | undefined,
      question: metadata.question as string | undefined,
      link: metadata.link as string | undefined,
      metadata,
    };
  });
}
