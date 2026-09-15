// Runs a Next.js command for one interface: node scripts/run-interface.mjs <web|merchant|admin> <next args...>
// The interface decides which route files are built (see pageExtensions in next.config.ts).
import { spawn } from "node:child_process";

const INTERFACES = ["web", "merchant", "admin"];
const [iface, ...args] = process.argv.slice(2);

if (!INTERFACES.includes(iface) || args.length === 0) {
  console.error("Usage: node scripts/run-interface.mjs <web|merchant|admin> <dev|build|start> [next options]");
  process.exit(1);
}

const isWindows = process.platform === "win32";
const child = spawn(isWindows ? "npx.cmd" : "npx", ["next", ...args], {
  stdio: "inherit",
  shell: isWindows,
  env: { ...process.env, APP_INTERFACE: iface },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
