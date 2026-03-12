import { createSolidTransformPlugin } from "./build/preload.ts"

const result = await Bun.build({
  entrypoints: ["./src/index.tsx"],
  outdir: "./bin",
  target: "bun",
  plugins: [createSolidTransformPlugin()],
  naming: "terroir.js",
})

if (!result.success) {
  for (const log of result.logs) {
    console.error(log)
  }
  process.exit(1)
}

const compile = Bun.spawn(["bun", "build", "--compile", "./bin/terroir.js", "--outfile", "./bin/terroir"], {
  stdout: "inherit",
  stderr: "inherit",
})
const exitCode = await compile.exited
if (exitCode !== 0) process.exit(exitCode)

await Bun.file("./bin/terroir.js").delete()
