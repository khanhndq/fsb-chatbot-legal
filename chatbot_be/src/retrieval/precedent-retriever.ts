import { embedQuery } from "./embedding";
import { normalizeTopK, queryPinecone } from "./pinecone";
import {
  RetrievePrecedentOptions,
  RetrievedDocument,
} from "./retrieval.types";

export async function retrievePrecedentByVector(
  vector: number[],
  options: RetrievePrecedentOptions = {},
): Promise<RetrievedDocument[]> {
  const topK = normalizeTopK(options.topK ?? 3);

  return queryPinecone(vector, topK, {
    source_type: { $eq: "precedent" },
  });
}

export async function retrievePrecedent(
  query: string,
  options: RetrievePrecedentOptions = {},
): Promise<RetrievedDocument[]> {
  const vector = await embedQuery(query);
  return retrievePrecedentByVector(vector, options);
}
