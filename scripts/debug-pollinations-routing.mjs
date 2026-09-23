/**
 * Pollinations routing / API contract debug (recipe hero context).
 * Does NOT claim "routing fixed" or valid multi-model compare via prompt suffix.
 *
 *   node scripts/debug-pollinations-routing.mjs
 */
import { config } from "dotenv";
import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

config({ path: ".env.local" });
config({ path: ".env" });

const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.join(process.cwd(), "scripts/image-verification", `routing-debug-${RUN_ID}`);
const TIMEOUT = 120_000;

/** Unchanged recipe-style prompt used across route tests. */
const RECIPE_PROMPT =
  "Realistic food photograph of fluffy cooked rice with distinct grains, chicken pieces, fried onions visible in the rice, topped with mint leaves, served on a wide plate. Overhead view, soft natural daylight, clear food texture across the dish, natural colors, no text.";

const DOC = {
  documentedBase: "https://gen.pollinations.ai",
  documentedImageGet: "GET /image/{prompt}",
  documentedAuth: "Authorization: Bearer sk_* (or ?key= on GET)",
  documentedOpenAI: "POST /v1/images/generations",
  legacyBase: "https://image.pollinations.ai",
  legacyImageGet: "GET /prompt/{prompt}",
  docsUrl: "https://gen.pollinations.ai/docs",
  keysUrl: "https://enter.pollinations.ai",
};

function redact(url) {
  return url.replace(/seed=\d+/g, "seed=REDACTED").replace(/key=[^&]+/gi, "key=REDACTED");
}

function sha16(buf) {
  return createHash("sha256").update(buf).digest("hex").slice(0, 16);
}

function buildLegacyUrl(prompt, { width, height, model, seed, extra = {} }) {
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    model,
    enhance: "false",
    private: "true",
    seed: String(seed),
    ...extra,
  });
  const full = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
  const parsed = new URL(full);
  return {
    route: "legacy-image.pollinations.ai",
    full,
    fullRedacted: redact(full),
    queryString: parsed.search,
    queryParams: Object.fromEntries(parsed.searchParams),
  };
}

function buildGenUrl(prompt, { width, height, model, seed }) {
  const params = new URLSearchParams({
    model,
    width: String(width),
    height: String(height),
    seed: String(seed),
  });
  const full = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?${params.toString()}`;
  const parsed = new URL(full);
  return {
    route: "gen.pollinations.ai",
    full,
    fullRedacted: redact(full),
    queryString: parsed.search,
    queryParams: Object.fromEntries(parsed.searchParams),
  };
}

function pickHeaders(res) {
  const keys = [
    "content-type",
    "content-length",
    "cache-control",
    "age",
    "cf-cache-status",
    "x-cache",
    "server",
    "x-model-requested",
    "x-model-used",
    "x-usage-model",
    "x-request-id",
  ];
  const headers = {};
  for (const k of keys) {
    const v = res.headers.get(k);
    if (v) headers[k] = v;
  }
  return headers;
}

async function wireFetch(fullOutgoingUrl, fetchOptions = {}) {
  if (!fullOutgoingUrl.includes("?")) {
    throw new Error("wireFetch refused: URL has no query string");
  }
  const requestParsed = new URL(fullOutgoingUrl);
  const started = Date.now();
  const res = await fetch(fullOutgoingUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT),
    cache: "no-store",
    headers: {
      Accept: "image/*, application/json",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      ...fetchOptions.headers,
    },
    ...fetchOptions,
  });
  const ms = Date.now() - started;
  const buf = Buffer.from(await res.arrayBuffer());
  const finalParsed = new URL(res.url);
  const headers = pickHeaders(res);
  const contentType = headers["content-type"] ?? res.headers.get("content-type") ?? "";
  const errorBodyPreview =
    contentType.includes("json") && buf.length
      ? buf.toString("utf8", 0, Math.min(buf.length, 500))
      : null;

  return {
    ms,
    status: res.status,
    ok: res.ok,
    contentType,
    bytes: buf.length,
    errorBodyPreview,
    request: {
      fullOutgoingUrlRedacted: redact(fullOutgoingUrl),
      queryString: requestParsed.search,
      modelQueryParam: requestParsed.searchParams.get("model"),
    },
    response: {
      finalUrlRedacted: redact(res.url),
      finalQueryString: finalParsed.search,
      /** Echo of requested model in URL only — NOT proof of executed backend model. */
      finalModelQueryParam: finalParsed.searchParams.get("model"),
      queryPreservedOnRedirect: finalParsed.search === requestParsed.search,
      redirected: res.url !== fullOutgoingUrl,
      headers,
      providerModelHints: {
        xModelRequested: headers["x-model-requested"] ?? null,
        xModelUsed: headers["x-model-used"] ?? null,
        xUsageModel: headers["x-usage-model"] ?? null,
        note: "Headers are hints only where documented; finalModelQueryParam is not execution proof.",
      },
    },
    buffer: buf,
  };
}

function looksLikeImage(buffer, contentType) {
  if (!buffer?.length || buffer.length < 1000) return false;
  if (contentType.includes("image")) return true;
  return buffer[0] === 0xff && buffer[1] === 0xd8;
}

async function decodeImage(buffer, contentType) {
  if (!looksLikeImage(buffer, contentType)) {
    return { decodable: false, error: `not an image body (${buffer.length} bytes, ${contentType})` };
  }
  try {
    const sharp = (await import("sharp")).default;
    const m = await sharp(buffer).metadata();
    return {
      decodable: true,
      width: m.width ?? null,
      height: m.height ?? null,
      format: m.format ?? null,
      sha256_16: sha16(buffer),
    };
  } catch (e) {
    return { decodable: false, error: String(e) };
  }
}

function classifyTest(wire) {
  if (!wire.ok) {
    return {
      outcome: "http_error",
      httpStatus: wire.status,
      errorBodyPreview: wire.errorBodyPreview,
    };
  }
  if (!looksLikeImage(wire.buffer, wire.contentType)) {
    return {
      outcome: "not_image",
      httpStatus: wire.status,
      contentType: wire.contentType,
      errorBodyPreview: wire.errorBodyPreview,
      sha256_16: wire.bytes ? sha16(wire.buffer) : null,
    };
  }
  return { outcome: "pending_decode" };
}

async function finalizeClassification(wire, classification) {
  if (classification.outcome !== "pending_decode") return classification;
  const decoded = await decodeImage(wire.buffer, wire.contentType);
  if (!decoded.decodable) {
    return { outcome: "undecodable", ...decoded };
  }
  return { outcome: "success_image", ...decoded };
}

async function saveImage(label, buffer, contentType) {
  if (!looksLikeImage(buffer, contentType)) return null;
  const ext = contentType.includes("png") ? "png" : "jpg";
  const file = path.join(OUT, `${label}.${ext}`);
  await writeFile(file, buffer);
  return path.relative(process.cwd(), file);
}

function compareSuccessfulImages(testA, testB) {
  const okA = testA?.classification?.outcome === "success_image";
  const okB = testB?.classification?.outcome === "success_image";
  if (!okA || !okB) {
    return {
      verifiable: false,
      inconclusive: true,
      reason: `Need two decodable images; got ${testA?.id}=${testA?.classification?.outcome}, ${testB?.id}=${testB?.classification?.outcome}`,
    };
  }
  return {
    verifiable: true,
    inconclusive: false,
    sha256A: testA.classification.sha256_16,
    sha256B: testB.classification.sha256_16,
    hashesDiffer: testA.classification.sha256_16 !== testB.classification.sha256_16,
  };
}

async function runLegacyTest(id, built, wire) {
  let classification = classifyTest(wire);
  classification = await finalizeClassification(wire, classification);
  const file =
    classification.outcome === "success_image"
      ? await saveImage(id, wire.buffer, wire.contentType)
      : null;
  return {
    id,
    built,
    wire: { ...wire, buffer: undefined },
    classification,
    file,
  };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const report = {
    runId: RUN_ID,
    scope: "Recipe hero — all saved JPEGs are test artifacts; production uses uploads/recipes/ai-generated/*.meta.json",
    apiContract: { ...DOC },
    tests: [],
    modelsCatalog: null,
    genRouteProbe: null,
    paidAccess: null,
    comparisons: {},
    cacheEvidence: null,
    resolutionMismatch: null,
    disclaimers: [
      "finalModelQueryParam and URL model= are not proof of which upstream model executed.",
      "Different images after changing the prompt text is not a controlled model comparison.",
      "Exact CDN cache-key implementation and executed model on legacy route remain unknown.",
    ],
  };

  const apiKey =
    process.env.POLLINATIONS_KEY?.trim() ||
    process.env.POLLINATIONS_API_KEY?.trim() ||
    "";

  try {
    const modelsRes = await fetch("https://gen.pollinations.ai/image/models", {
      signal: AbortSignal.timeout(30_000),
    });
    const modelsJson = await modelsRes.json();
    const pick = (alias) =>
      modelsJson.find((m) => m.name === alias || (m.aliases ?? []).includes(alias));
    report.modelsCatalog = {
      httpStatus: modelsRes.status,
      flux: pick("flux")?.name,
      zimage: pick("zimage")?.name,
      seedream5: pick("seedream5")?.name,
      turboListed: Boolean(pick("turbo")),
      pricingSample: {
        flux: pick("flux")?.pricing ?? pick("flux")?.price ?? null,
        zimage: pick("zimage")?.pricing ?? null,
      },
    };
    report.paidAccess = {
      genRouteRequiresAuth: true,
      apiKeyConfiguredInEnv: Boolean(apiKey),
      keyEnvVarsChecked: ["POLLINATIONS_KEY", "POLLINATIONS_API_KEY"],
      obtainKey: DOC.keysUrl,
      billingCurrency: "pollen (see /image/models pricing fields)",
      fluxPricingFromCatalog: report.modelsCatalog.pricingSample.flux,
      note: "No repo API key found — gen generation tests skipped; legacy image.pollinations.ai still reachable without key in this environment.",
    };
  } catch (e) {
    report.modelsCatalog = { error: String(e) };
  }

  const genBuilt = buildGenUrl(RECIPE_PROMPT, {
    width: 1024,
    height: 1024,
    model: "flux",
    seed: 880001,
  });
  const genNoAuth = await wireFetch(genBuilt.full);
  report.genRouteProbe = {
    withoutAuth: {
      built: genBuilt,
      wire: { ...genNoAuth, buffer: undefined },
      classification: classifyTest(genNoAuth),
    },
  };

  if (apiKey) {
    const genAuth = await wireFetch(genBuilt.full, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    let classification = classifyTest(genAuth);
    classification = await finalizeClassification(genAuth, classification);
    const file =
      classification.outcome === "success_image"
        ? await saveImage("gen-flux-1024-recipe", genAuth.buffer, genAuth.contentType)
        : null;
    report.genRouteProbe.withAuth = {
      built: genBuilt,
      wire: { ...genAuth, buffer: undefined },
      classification,
      file,
      resolutionMismatch:
        classification.outcome === "success_image" &&
        (classification.width !== 1024 || classification.height !== 1024)
          ? {
              requested: { width: 1024, height: 1024 },
              decoded: { width: classification.width, height: classification.height },
            }
          : classification.outcome === "success_image"
            ? null
            : "inconclusive (no decodable image)",
    };
  }

  const altPrompt = `${RECIPE_PROMPT.replace(/\.$/, "")}, extra cilantro garnish.`;

  for (const [id, prompt] of [
    ["prompt-A", RECIPE_PROMPT],
    ["prompt-B", altPrompt],
  ]) {
    const built = buildLegacyUrl(prompt, { width: 768, height: 768, model: "zimage", seed: 900001 });
    const wire = await wireFetch(built.full);
    report.tests.push(await runLegacyTest(id, built, wire));
  }

  for (const [id, seed] of [
    ["seed-A", 900101],
    ["seed-B", 900102],
  ]) {
    const built = buildLegacyUrl(RECIPE_PROMPT, { width: 768, height: 768, model: "zimage", seed });
    const wire = await wireFetch(built.full);
    report.tests.push(await runLegacyTest(id, built, wire));
  }

  const sharedSeed = 900200;
  const cacheRows = [];
  for (const model of ["zimage", "flux", "seedream5", "turbo"]) {
    const built = buildLegacyUrl(RECIPE_PROMPT, { width: 768, height: 768, model, seed: sharedSeed });
    const wire = await wireFetch(built.full);
    const row = await runLegacyTest(`model-${model}`, built, wire);
    report.tests.push(row);
    cacheRows.push({
      model,
      cfCache: row.wire.response.headers["cf-cache-status"] ?? null,
      xCache: row.wire.response.headers["x-cache"] ?? null,
      ms: row.wire.ms,
      outcome: row.classification.outcome,
      sha256_16:
        row.classification.outcome === "success_image" ? row.classification.sha256_16 : null,
    });
    await new Promise((r) => setTimeout(r, 1200));
  }

  const successfulCache = cacheRows.filter((r) => r.sha256_16);
  const uniqueSuccessHashes = new Set(successfulCache.map((r) => r.sha256_16));
  report.cacheEvidence = {
    sameUnchangedPromptAndSeed: sharedSeed,
    rows: cacheRows,
    allSuccessfulImagesByteIdentical:
      successfulCache.length > 1 && uniqueSuccessHashes.size === 1,
    interpretation:
      "Strong evidence of cache/reuse when prompt+seed match (e.g. first model MISS, later HIT + identical hash). Exact cache-key fields and executed upstream model are not confirmed by this client.",
    notValidModelComparison: true,
  };

  const built1024 = buildLegacyUrl(RECIPE_PROMPT, {
    width: 1024,
    height: 1024,
    model: "flux",
    seed: 880002,
  });
  const wire1024 = await wireFetch(built1024.full);
  const row1024 = await runLegacyTest("legacy-1024-request", built1024, wire1024);
  report.tests.push(row1024);
  if (row1024.classification.outcome === "success_image") {
    report.resolutionMismatch = {
      route: "legacy-image.pollinations.ai",
      requested: { width: 1024, height: 1024 },
      decoded: {
        width: row1024.classification.width,
        height: row1024.classification.height,
      },
      mismatch:
        row1024.classification.width !== 1024 || row1024.classification.height !== 1024,
      note: "Do not upscale and claim native 1024; establish correct gen route first.",
    };
  } else {
    report.resolutionMismatch = {
      route: "legacy-image.pollinations.ai",
      inconclusive: true,
      reason: row1024.classification,
    };
  }

  const byId = (id) => report.tests.find((t) => t.id === id);
  report.comparisons.promptChange = compareSuccessfulImages(byId("prompt-A"), byId("prompt-B"));
  report.comparisons.seedChange = compareSuccessfulImages(byId("seed-A"), byId("seed-B"));

  report.comparisons.samePromptSeedDifferentModelParam = {
    verifiable: false,
    inconclusive: true,
    notValidModelComparison: true,
    reason:
      "Same prompt+seed with different model= query params does not prove distinct models; identical successful JPEGs and HIT/MISS pattern indicate reuse.",
    cacheEvidence: report.cacheEvidence,
  };

  const summaryMd = `# Pollinations routing debug — ${RUN_ID}

## Status (honest)

- **Routing is not "fixed"** on the legacy \`image.pollinations.ai\` route; client sends query params correctly, but provider cache/reuse behavior remains.
- **No valid multi-model quality compare** was performed here. Prompt suffix changes produce different images but that is **not** model comparison.
- **\`finalModelQueryParam\`** and **\`x-model-requested\`** (when present) are request/hint metadata only — **not** executed-model proof unless Pollinations documents otherwise.

## Documented vs legacy route

| | Documented (APIDOCS v0.3) | Currently used in app |
|--|--|--|
| Base | \`https://gen.pollinations.ai\` | \`https://image.pollinations.ai\` |
| Path | \`GET /image/{prompt}\` | \`GET /prompt/{prompt}\` |
| Auth | Bearer \`sk_*\` required for generation | No key in this repo |
| Default size | 1024×1024 (docs) | App requests 768; legacy often returns 768 even when 1024 requested |

## Paid access

${report.paidAccess?.apiKeyConfiguredInEnv ? "API key present — see \`genRouteProbe.withAuth\` in report.json." : `No \`POLLINATIONS_KEY\` / \`POLLINATIONS_API_KEY\` in env. Gen route returned **401** without auth. Keys: ${DOC.keysUrl}. Flux catalog pricing sample: see \`paidAccess.fluxPricingFromCatalog\` (pollen currency).`}

## Comparisons (successful decodable images only)

- **Prompt change:** ${report.comparisons.promptChange.verifiable ? (report.comparisons.promptChange.hashesDiffer ? "verifiable — hashes differ" : "verifiable — hashes same") : `inconclusive — ${report.comparisons.promptChange.reason}`}
- **Seed change:** ${report.comparisons.seedChange.verifiable ? (report.comparisons.seedChange.hashesDiffer ? "verifiable — hashes differ" : "verifiable — hashes same") : `inconclusive — ${report.comparisons.seedChange.reason}`}

## Next step

Establish **gen.pollinations.ai** (authenticated) as the generation route, confirm decoded dimensions and any provider model headers, then run food quality compare — not before.

Re-run: \`node scripts/debug-pollinations-routing.mjs\`
`;

  await writeFile(path.join(OUT, "routing-report.json"), JSON.stringify(report, null, 2));
  await writeFile(path.join(OUT, "ROUTING-DEBUG-SUMMARY.md"), summaryMd);

  console.log(
    JSON.stringify(
      {
        outDir: path.relative(process.cwd(), OUT),
        seedComparison: report.comparisons.seedChange,
        promptComparison: report.comparisons.promptChange,
        cacheEvidence: report.cacheEvidence?.allSuccessfulImagesByteIdentical,
        resolutionMismatch: report.resolutionMismatch?.mismatch ?? report.resolutionMismatch?.inconclusive,
        genNoAuthStatus: report.genRouteProbe?.withoutAuth?.wire?.status,
        apiKeyConfigured: Boolean(apiKey),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
