import { buildLinkMap } from "./parsers/law-parser";
import {
  AverageChunkLengthStats,
  Chunk,
  DomainDistributionStats,
} from "./types";

interface ChunkAnalysis {
  averageChunkLength: AverageChunkLengthStats;
  domainDistribution: DomainDistributionStats;
}

function round(value: number, decimals: number = 2): number {
  return Number(value.toFixed(decimals));
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}

function extractDomain(link: string | undefined): string | null {
  if (!link?.trim()) {
    return null;
  }

  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function backfillLawLinks(chunks: Chunk[], lawsSourceDir: string): Chunk[] {
  const linkMap = buildLinkMap(lawsSourceDir);

  return chunks.map((chunk) => {
    if (chunk.metadata.source_type !== "law" || chunk.metadata.link) {
      return chunk;
    }

    const fallbackLink = linkMap.get(chunk.metadata.document_name);
    if (!fallbackLink) {
      return chunk;
    }

    return {
      ...chunk,
      metadata: {
        ...chunk.metadata,
        link: fallbackLink,
      },
    };
  });
}

export function calculateAverageChunkLength(
  chunks: Chunk[],
): AverageChunkLengthStats {
  if (chunks.length === 0) {
    return {
      characters: 0,
      words: 0,
      estimatedTokens: 0,
    };
  }

  const totalCharacters = chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
  const totalWords = chunks.reduce((sum, chunk) => sum + countWords(chunk.text), 0);
  const totalEstimatedTokens = chunks.reduce(
    (sum, chunk) => sum + estimateTokens(chunk.text),
    0,
  );

  return {
    characters: round(totalCharacters / chunks.length),
    words: round(totalWords / chunks.length),
    estimatedTokens: round(totalEstimatedTokens / chunks.length),
  };
}

export function calculateDomainDistribution(
  chunks: Chunk[],
): DomainDistributionStats {
  const domainCounts = new Map<string, number>();
  let totalLinkedLawChunks = 0;
  let lawChunksWithoutLink = 0;

  for (const chunk of chunks) {
    if (chunk.metadata.source_type !== "law") {
      continue;
    }

    const domain = extractDomain(chunk.metadata.link);
    if (!domain) {
      lawChunksWithoutLink++;
      continue;
    }

    totalLinkedLawChunks++;
    domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
  }

  const domains = Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([domain, count]) => ({
      domain,
      count,
      percentage:
        totalLinkedLawChunks === 0 ? 0 : round((count / totalLinkedLawChunks) * 100),
    }));

  return {
    basis: "linked_law_chunks",
    totalLinkedLawChunks,
    lawChunksWithoutLink,
    domains,
  };
}

export function calculateChunkAnalysis(
  chunks: Chunk[],
  lawsSourceDir: string,
): ChunkAnalysis {
  const enrichedChunks = backfillLawLinks(chunks, lawsSourceDir);

  return {
    averageChunkLength: calculateAverageChunkLength(enrichedChunks),
    domainDistribution: calculateDomainDistribution(enrichedChunks),
  };
}
