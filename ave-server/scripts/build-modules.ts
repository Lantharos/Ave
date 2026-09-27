import { mkdir, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const exports = "export { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';\n";
await mkdir("src/generated", { recursive: true });
await build({
  stdin: { contents: exports, resolveDir: process.cwd(), sourcefile: "webauthn.ts" },
  outfile: "src/generated/webauthn.mjs",
  bundle: true,
  minify: true,
  format: "esm",
  platform: "browser",
  target: "es2024",
  external: ["node:*"],
});
await writeFile("src/generated/webauthn.d.mts", exports);
