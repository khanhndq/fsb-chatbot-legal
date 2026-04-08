import * as fs from "node:fs";
import * as path from "node:path";

let envLoaded = false;

function stripInlineComment(value: string): string {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    if (char === "#" && !inSingleQuote && !inDoubleQuote) {
      return value.slice(0, i).trim();
    }
  }

  return value.trim();
}

function parseEnvFile(content: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const exportPrefix = line.startsWith("export ") ? "export " : "";
    const assignment = exportPrefix ? line.slice(exportPrefix.length) : line;
    const equalsIndex = assignment.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = assignment.slice(0, equalsIndex).trim();
    let value = stripInlineComment(assignment.slice(equalsIndex + 1));

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      values[key] = value;
    }
  }

  return values;
}

function candidateEnvPaths(): string[] {
  const repoRoot = path.resolve(__dirname, "../../..");

  return [
    path.join(repoRoot, "eval", ".env"),
    path.join(repoRoot, "chatbot_be", ".env"),
    path.join(repoRoot, "chatbot-indexing", ".env"),
    path.join(repoRoot, "RAGAs", ".env"),
  ];
}

export function ensureRetrievalEnv(): void {
  if (envLoaded) {
    return;
  }

  envLoaded = true;

  for (const envPath of candidateEnvPaths()) {
    if (!fs.existsSync(envPath)) {
      continue;
    }

    const parsed = parseEnvFile(fs.readFileSync(envPath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (!(key in process.env) || !process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}
