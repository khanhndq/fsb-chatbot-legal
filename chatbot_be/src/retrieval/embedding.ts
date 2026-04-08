import OpenAI from "openai";
import { ensureRetrievalEnv } from "./env";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  ensureRetrievalEnv();
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not configured. Checked process.env and repository .env files.",
      );
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export async function embedQuery(query: string): Promise<number[]> {
  const openai = getOpenAI();
  const embeddingModel = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
  const embeddingDimensions = parseInt(
    process.env.EMBEDDING_DIMENSIONS || "1536",
    10,
  );

  const response = await openai.embeddings.create({
    model: embeddingModel,
    dimensions: embeddingDimensions,
    input: query,
  });

  return response.data[0].embedding;
}
