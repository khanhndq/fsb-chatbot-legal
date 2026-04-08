import { embedQuery } from "./embedding";
import { retrieveLawByVector } from "./law-retriever";
import { normalizeTopK } from "./pinecone";
import { retrievePrecedentByVector } from "./precedent-retriever";
import {
  HybridRetrieveOptions,
  HybridRetrieveResult,
} from "./retrieval.types";

export async function retrieveHybrid(
  query: string,
  options: HybridRetrieveOptions = {},
): Promise<HybridRetrieveResult> {
  const topK = normalizeTopK(options.topK ?? 5);
  const lawTopK = normalizeTopK(options.lawTopK ?? topK);
  const precedentTopK = normalizeTopK(
    options.precedentTopK ?? Math.min(topK, 3),
  );
  const vector = await embedQuery(query);

  if (options.sourceType === "law" || options.sourceType === "faq") {
    const lawResults = await retrieveLawByVector(vector, {
      topK: lawTopK,
      sourceTypes: [options.sourceType],
    });
    return {
      lawResults,
      precedentResults: [],
      total: lawResults.length,
    };
  }

  if (options.sourceType === "precedent") {
    const precedentResults = await retrievePrecedentByVector(vector, {
      topK: precedentTopK,
    });
    return {
      lawResults: [],
      precedentResults,
      total: precedentResults.length,
    };
  }

  const [lawResults, precedentResults] = await Promise.all([
    retrieveLawByVector(vector, { topK: lawTopK }),
    retrievePrecedentByVector(vector, { topK: precedentTopK }),
  ]);

  return {
    lawResults,
    precedentResults,
    total: lawResults.length + precedentResults.length,
  };
}
