import { embedQuery } from "./embedding";
import { normalizeTopK, queryPinecone } from "./pinecone";
import { RetrieveLawOptions, RetrievedDocument } from "./retrieval.types";

export async function retrieveLawByVector(
  vector: number[],
  options: RetrieveLawOptions = {},
): Promise<RetrievedDocument[]> {
  const topK = normalizeTopK(options.topK ?? 5);
  const sourceTypes = options.sourceTypes?.length
    ? options.sourceTypes
    : ["law", "faq"];

  if (sourceTypes.length === 1) {
    return queryPinecone(vector, topK, {
      source_type: { $eq: sourceTypes[0] },
    });
  }

  return queryPinecone(vector, topK, {
    source_type: { $in: sourceTypes },
  });
}

export async function retrieveLaw(
  query: string,
  options: RetrieveLawOptions = {},
): Promise<RetrievedDocument[]> {
  const vector = await embedQuery(query);
  return retrieveLawByVector(vector, options);
}
