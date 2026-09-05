import { access, cp, mkdir } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const standaloneRoot = join(root, ".next", "standalone");
const serverFile = join(standaloneRoot, "server.js");
const staticSource = join(root, ".next", "static");
const staticTarget = join(standaloneRoot, ".next", "static");

await access(serverFile);
await mkdir(join(standaloneRoot, ".next"), { recursive: true });
await cp(staticSource, staticTarget, { recursive: true, force: true });

console.log("Standalone deployment artifact is staged.");
