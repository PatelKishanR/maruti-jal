#!/usr/bin/env node
/**
 * Enforces the layering rule from .claude/ARCHITECTURE.md §4:
 *
 *   FE (pages, components)  →  API route  →  Service  →  Repository  →  DB
 *
 * Violations this catches:
 *   1. Anything under src/app (except src/app/api) or src/components importing
 *      a service, a repository, or the DataSource.
 *   2. A service importing the DataSource for anything other than withTx.
 *   3. An API route importing a repository directly, skipping the service.
 *   4. A repository importing another repository (cross-entity coupling).
 *
 * Run: npm run check:layering   (also part of `npm run verify`)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

const violations = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      check(full);
    }
  }
}

function check(file) {
  const rel = relative(ROOT, file).split(sep).join("/");
  const source = readFileSync(file, "utf8");

  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(
    (m) => m[1],
  );
  // A type-only import is erased at compile time and couples nothing.
  const valueImports = [
    ...source.matchAll(/^\s*import\s+(?!type\s)([^;]+?)\s+from\s+["']([^"']+)["']/gm),
  ].map((m) => m[2]);

  const isApiRoute = rel.startsWith("src/app/api/");
  const isFrontend =
    (rel.startsWith("src/app/") && !isApiRoute) || rel.startsWith("src/components/");
  const isService = rel.startsWith("src/lib/services/");
  const isRepository = rel.startsWith("src/lib/repositories/");

  // ---- 1. Frontend must not reach past the API -------------------------
  if (isFrontend) {
    for (const imp of valueImports) {
      if (
        imp.includes("lib/services") ||
        imp.includes("lib/repositories") ||
        imp.includes("lib/db/")
      ) {
        violations.push(
          `${rel}\n    imports "${imp}"\n    → Frontend must fetch through the API (lib/api/client). ` +
            `Type-only imports are fine; this is a value import.`,
        );
      }
    }
  }

  // ---- 2. Services own transactions, not raw connections ---------------
  if (isService) {
    for (const imp of valueImports) {
      if (imp.includes("lib/db/data-source")) {
        const usesOnlyTx = /import\s*\{\s*withTx\s*\}\s*from/.test(source);
        if (!usesOnlyTx) {
          violations.push(
            `${rel}\n    imports "${imp}"\n    → Services may import only withTx. ` +
              `All queries go through a repository.`,
          );
        }
      }
      if (imp.includes("lib/db/entities") && !/import\s+type/.test(source)) {
        // Entities as values (e.g. passing the class to getRepository) means
        // the service is querying directly.
        const valueEntityImport = new RegExp(
          `import\\s+\\{[^}]*\\}\\s+from\\s+["']${imp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`,
        );
        if (valueEntityImport.test(source) && /getRepository|createQueryBuilder/.test(source)) {
          violations.push(
            `${rel}\n    queries entities directly\n    → Move the query into a repository.`,
          );
        }
      }
    }
  }

  // ---- 3. API routes call services, not repositories -------------------
  if (isApiRoute) {
    for (const imp of valueImports) {
      if (imp.includes("lib/repositories") || imp.includes("lib/db/data-source")) {
        violations.push(
          `${rel}\n    imports "${imp}"\n    → API routes call SERVICES. Repositories are for services only.`,
        );
      }
    }
  }

  // ---- 4. Repositories stay single-entity ------------------------------
  if (isRepository && !rel.endsWith("base.repository.ts")) {
    for (const imp of imports) {
      if (imp.includes("lib/repositories/") && !imp.includes("base.repository")) {
        violations.push(
          `${rel}\n    imports "${imp}"\n    → One repository per entity. ` +
            `If a service needs two entities, it calls two repositories.`,
        );
      }
      if (imp.includes("lib/services")) {
        violations.push(
          `${rel}\n    imports "${imp}"\n    → Repositories never call services. Dependencies point one way.`,
        );
      }
    }
  }
}

walk(SRC);

if (violations.length > 0) {
  console.error("\n✗ Layering violations\n");
  for (const v of violations) console.error(`  ${v}\n`);
  console.error(
    `${violations.length} violation(s). See .claude/ARCHITECTURE.md §4\n`,
  );
  process.exit(1);
}

console.log("✓ Layering clean — FE → API → Service → Repository → DB");
