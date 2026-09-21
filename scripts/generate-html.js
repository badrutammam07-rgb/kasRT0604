import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, cpSync, existsSync } from "node:fs";

async function main() {
  console.log("Generating static dist/index.html for deployment...");
  mkdirSync("dist", { recursive: true });

  if (existsSync(".output/public")) {
    cpSync(".output/public", "dist", { recursive: true });
  }

  const port = 3388;
  const server = spawn("node", [".output/server/index.mjs"], {
    env: { ...process.env, PORT: String(port), NODE_ENV: "production" },
    stdio: "ignore",
  });

  try {
    let html = "";
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/`);
        if (res.ok) {
          html = await res.text();
          break;
        }
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    if (html) {
      writeFileSync("dist/index.html", html, "utf-8");
      writeFileSync("dist/404.html", html, "utf-8");
      if (existsSync(".output/public")) {
        writeFileSync(".output/public/index.html", html, "utf-8");
      }
      console.log("Successfully wrote dist/index.html and dist/404.html");

      // Also generate route subdirectories if possible
      for (const route of ["pusat", "belum-bayar"]) {
        try {
          const res = await fetch(`http://127.0.0.1:${port}/${route}`);
          if (res.ok) {
            const routeHtml = await res.text();
            mkdirSync(`dist/${route}`, { recursive: true });
            writeFileSync(`dist/${route}/index.html`, routeHtml, "utf-8");
            console.log(`Successfully wrote dist/${route}/index.html`);
          }
        } catch {}
      }
    } else {
      console.warn("Could not retrieve HTML from temporary server, using fallback");
    }
  } finally {
    server.kill();
  }
}

main().catch((err) => {
  console.error("Error in generate-html:", err);
  process.exit(0); // non-fatal
});
