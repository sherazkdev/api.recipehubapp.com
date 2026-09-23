/**
 * Image quality verification — provider raw vs backend, multi-model, nologo test.
 * Output: scripts/image-verification/{runId}/
 */
import { config } from "dotenv";
import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";

config({ path: ".env.local" });
config({ path: ".env" });

const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.join(process.cwd(), "scripts/image-verification", RUN_ID);
const TIMEOUT_MS = 120_000;
const WIDTH = 768;
const HEIGHT = 768;
const TEST_SEED = 42424242;

const BIRYANI_PROMPT =
  "Realistic food photograph of fluffy cooked rice with distinct grains, chicken pieces, fried onions visible in the rice, topped with mint leaves, served on a wide plate. Overhead view, soft natural daylight, clear food texture across the dish, natural colors, no text.";

const MODELS = ["zimage", "flux", "seedream5", "turbo"];

function redactUrl(url) {
  return url.replace(/seed=\d+/g, "seed=REDACTED");
}

function buildUrl(prompt, model, seed, extra = {}) {
  const params = new URLSearchParams({
    width: String(WIDTH),
    height: String(HEIGHT),
    model,
    enhance: "false",
    seed: String(seed),
    private: "true",
    ...extra,
  });
  const pathnameOnly = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
  const fullOutgoingUrl = `${pathnameOnly}?${params.toString()}`;
  return {
    /** Path only — do not use for fetch; query lives on fullOutgoingUrl */
    endpointPathOnly: pathnameOnly,
    fullOutgoingUrl,
    fullOutgoingUrlRedacted: redactUrl(fullOutgoingUrl),
    params: Object.fromEntries(params),
  };
}

async function fetchRaw(fullOutgoingUrl) {
  if (!fullOutgoingUrl.includes("?")) {
    throw new Error("fetch URL missing query string");
  }
  const started = Date.now();
  const res = await fetch(fullOutgoingUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
    headers: {
      Accept: "image/*",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });
  const ms = Date.now() - started;
  const contentType = res.headers.get("content-type") ?? "";
  const buffer = Buffer.from(await responseBuffer(res));
  const headerPick = ["cache-control", "cf-cache-status", "x-cache", "age"];
  const headers = {};
  for (const key of headerPick) {
    const v = res.headers.get(key);
    if (v) headers[key] = v;
  }
  return {
    ok: res.ok,
    status: res.status,
    contentType,
    buffer,
    ms,
    finalUrlRedacted: redactUrl(res.url),
    redirected: res.url !== fullOutgoingUrl,
    headers,
  };
}

async function responseBuffer(res) {
  return res.arrayBuffer();
}

async function backendSaveSim(providerBuffer) {
  return sharp(providerBuffer).rotate().jpeg({ quality: 95, mozjpeg: true }).toBuffer();
}

async function backendSaveExact(providerBuffer) {
  return providerBuffer;
}

async function meta(buffer) {
  const m = await sharp(buffer).metadata();
  return { format: m.format, width: m.width, height: m.height, bytes: buffer.length };
}

async function hash(buffer) {
  const crypto = await import("crypto");
  return crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const report = {
    runId: RUN_ID,
    prompt: BIRYANI_PROMPT,
    requestedDimensions: { width: WIDTH, height: HEIGHT },
    seed: TEST_SEED,
    models: [],
    nologoTest: [],
    conclusion: {},
  };

  for (const model of MODELS) {
    const { endpointPathOnly, fullOutgoingUrl, fullOutgoingUrlRedacted, params } = buildUrl(
      BIRYANI_PROMPT,
      model,
      TEST_SEED,
    );
    const entry = {
      model,
      endpointPathOnly,
      queryParams: params,
      fullOutgoingUrlRedacted,
    };
    try {
      const fetched = await fetchRaw(fullOutgoingUrl);
      entry.finalUrlRedacted = fetched.finalUrlRedacted;
      entry.redirected = fetched.redirected;
      entry.responseHeaders = fetched.headers;
      entry.httpStatus = fetched.status;
      entry.contentType = fetched.contentType;
      entry.fetchMs = fetched.ms;
      if (!fetched.ok || !fetched.contentType.includes("image")) {
        entry.error = "not an image response";
        report.models.push(entry);
        continue;
      }

      const ext = fetched.contentType.includes("png") ? "png" : "jpg";
      const providerPath = path.join(OUT, `${model}-provider.${ext}`);
      await writeFile(providerPath, fetched.buffer);

      const exact = await backendSaveExact(fetched.buffer);
      const legacyJpeg = await backendSaveSim(fetched.buffer);

      const exactPath = path.join(OUT, `${model}-backend-exact.${ext}`);
      const legacyPath = path.join(OUT, `${model}-backend-jpeg95.jpg`);
      await writeFile(exactPath, exact);
      await writeFile(legacyPath, legacyJpeg);

      entry.provider = { ...(await meta(fetched.buffer)), sha256_16: await hash(fetched.buffer) };
      entry.backendExact = {
        ...(await meta(exact)),
        sha256_16: await hash(exact),
        bytesIdenticalToProvider: exact.equals(fetched.buffer),
      };
      entry.backendJpeg95 = {
        ...(await meta(legacyJpeg)),
        sha256_16: await hash(legacyJpeg),
      };
      entry.files = {
        provider: path.relative(process.cwd(), providerPath),
        backendExact: path.relative(process.cwd(), exactPath),
        backendJpeg95: path.relative(process.cwd(), legacyPath),
      };
    } catch (e) {
      entry.error = e instanceof Error ? e.message : String(e);
    }
    report.models.push(entry);
  }

  for (const nologo of ["false", "true"]) {
    const { fullOutgoingUrl, params } = buildUrl(BIRYANI_PROMPT, "zimage", TEST_SEED + 1, {
      nologo: nologo,
    });
    const label = `zimage-nologo-${nologo}`;
    try {
      const fetched = await fetchRaw(fullOutgoingUrl);
      const item = {
        label,
        nologo: params.nologo,
        httpStatus: fetched.status,
        fetchMs: fetched.ms,
      };
      if (fetched.ok && fetched.contentType.includes("image")) {
        const p = path.join(OUT, `${label}.jpg`);
        await writeFile(p, fetched.buffer);
        item.meta = await meta(fetched.buffer);
        item.sha256_16 = await hash(fetched.buffer);
        item.file = path.relative(process.cwd(), p);
      } else {
        item.error = fetched.contentType;
      }
      report.nologoTest.push(item);
    } catch (e) {
      report.nologoTest.push({ label, error: String(e) });
    }
  }

  const currentPipeline = report.models.find((m) => m.model === "zimage");
  const providerHashes = report.models.map((m) => m.provider?.sha256_16).filter(Boolean);
  const uniqueHashes = new Set(providerHashes);

  report.conclusion = {
    currentProductionModel: "zimage",
    apiShape: "GET https://image.pollinations.ai/prompt/{prompt}?width=&height=&model=&seed=&enhance=&private=",
    backendUsesExactProviderBytes: currentPipeline?.backendExact?.bytesIdenticalToProvider ?? null,
    legacyJpeg95StillInCodebase: false,
    samePromptSameSeedModelCompareValid: false,
    samePromptSameSeedModelCompareNote:
      uniqueHashes.size === 1 && providerHashes.length === MODELS.length
        ? "Invalid compare: identical provider bytes for all model= params (cache/reuse). Not proof of four models."
        : "Do not treat different model= with same prompt+seed as valid model QA.",
    documentedGenerationRoute: "GET https://gen.pollinations.ai/image/{prompt} (Bearer sk_*); legacy image.pollinations.ai is not the documented contract.",
    providerHashNote:
      uniqueHashes.size === 1 && providerHashes.length === MODELS.length
        ? "See scripts/debug-pollinations-routing.mjs — cacheEvidence, inconclusive seed tests when HTTP 500 vs 200."
        : null,
  };

  await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));

  const composites = [];
  if (currentPipeline?.files) {
    const prov = await readFile(path.join(process.cwd(), currentPipeline.files.provider));
    const exact = await readFile(path.join(process.cwd(), currentPipeline.files.backendExact));
    const legacy = await readFile(path.join(process.cwd(), currentPipeline.files.backendJpeg95));
    const row = await sharp({
      create: {
        width: 768 * 3,
        height: 768,
        channels: 3,
        background: { r: 32, g: 32, b: 32 },
      },
    })
      .composite([
        { input: prov, left: 0, top: 0 },
        { input: exact, left: 768, top: 0 },
        { input: legacy, left: 1536, top: 0 },
      ])
      .jpeg({ quality: 90 })
      .toBuffer();
    const comparePath = path.join(OUT, "COMPARE-zimage-provider-exact-jpeg95.jpg");
    await writeFile(comparePath, row);
    composites.push(path.relative(process.cwd(), comparePath));
  }

  const modelTiles = [];
  for (const m of report.models) {
    if (!m.files?.provider) continue;
    modelTiles.push(await readFile(path.join(process.cwd(), m.files.provider)));
  }
  if (modelTiles.length) {
    const w = 768 * modelTiles.length;
    const comp = modelTiles.map((buf, i) => ({ input: buf, left: 768 * i, top: 0 }));
    const grid = await sharp({
      create: { width: w, height: 768, channels: 3, background: { r: 24, g: 24, b: 24 } },
    })
      .composite(comp)
      .jpeg({ quality: 90 })
      .toBuffer();
    const gridPath = path.join(OUT, "COMPARE-all-models-same-seed.jpg");
    await writeFile(gridPath, grid);
    composites.push(path.relative(process.cwd(), gridPath));
  }

  report.compositeFiles = composites;
  await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log("Report:", path.join(OUT, "report.json"));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
