import * as fs from "fs";
import * as path from "path";
import { calculateChunkAnalysis } from "./chunk-analysis";
import { Chunk, PipelineStats } from "./types";

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function main(): void {
  const rawDataDir = path.join(__dirname, "..", "dataset", "raw");
  const jsonOutputDir = path.join(__dirname, "..", "dataset", "json");
  const allChunksPath = path.join(jsonOutputDir, "all_chunks.json");
  const statsPath = path.join(jsonOutputDir, "pipeline_stats.json");
  const lawsSourceDir = path.join(rawDataDir, "laws-source");

  if (!fs.existsSync(allChunksPath)) {
    throw new Error(`Missing ${allChunksPath}. Run the indexing pipeline first.`);
  }

  const chunks = readJsonFile<Chunk[]>(allChunksPath);
  const existingStats = fs.existsSync(statsPath)
    ? readJsonFile<Partial<PipelineStats>>(statsPath)
    : {};

  const analysis = calculateChunkAnalysis(chunks, lawsSourceDir);
  const mergedStats = {
    ...existingStats,
    totalChunks: existingStats.totalChunks ?? chunks.length,
    averageChunkLength: analysis.averageChunkLength,
    domainDistribution: analysis.domainDistribution,
  };

  fs.writeFileSync(statsPath, JSON.stringify(mergedStats, null, 2), "utf-8");

  console.log("📊 Chunk analysis updated");
  console.log(`  Total chunks: ${chunks.length}`);
  console.log(
    `  Average chunk length: ${analysis.averageChunkLength.characters} chars | ${analysis.averageChunkLength.words} words | ~${analysis.averageChunkLength.estimatedTokens} tokens`,
  );

  if (analysis.domainDistribution.domains.length > 0) {
    console.log("  Domain distribution (% of linked law chunks):");
    for (const domain of analysis.domainDistribution.domains) {
      console.log(`    - ${domain.domain}: ${domain.percentage}% (${domain.count} chunks)`);
    }
  } else {
    console.log("  Domain distribution: no linked law chunks found");
  }

  if (analysis.domainDistribution.lawChunksWithoutLink > 0) {
    console.log(
      `  Missing/invalid law links: ${analysis.domainDistribution.lawChunksWithoutLink} chunks`,
    );
  }

  console.log(`  Saved to ${statsPath}`);
}

main();
