import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const testFiles = (await readdir(new URL("../tests/", import.meta.url)))
  .filter((name) => name.endsWith(".test.ts"))
  .sort()
  .map((name) => `tests/${name}`);

if (testFiles.length === 0) {
  console.error("No .test.ts files found in tests/.");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...testFiles],
  { cwd: root, stdio: "inherit" },
);

process.exit(result.status ?? 1);
