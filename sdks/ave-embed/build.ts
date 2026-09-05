import { rm } from "node:fs/promises";
import { join } from "node:path";

const root = import.meta.dir;
const outdir = join(root, "dist");
await rm(outdir, { recursive: true, force: true });
const result = await Bun.build({
  entrypoints: [join(root, "src/embed.js")],
  outdir,
  target: "browser",
  format: "esm",
});
if (!result.success) throw new AggregateError(result.logs, "Embed build failed");
await Bun.write(join(outdir, "embed.d.ts"), Bun.file(join(root, "src/embed.d.ts")));
