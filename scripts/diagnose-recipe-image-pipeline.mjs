/**
 * Compare Pollinations models + provider raw vs backend re-encode.
 * Output: scripts/image-diagnosis/report.json + sample files per case.
 */
import { config } from "dotenv";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

config({ path: ".env.local" });
config({ path: ".env" });

const OUT_DIR = path.join(process.cwd(), "scripts/image-diagnosis");
const WIDTH = 1024;
const HEIGHT = 1024;
const TIMEOUT_MS = 120_000;

const CASES = [
  {
    id: "lentil-stew",
    prompt:
      "Realistic food photograph of a thick cooked lentil stew, individual tender lentils visible, topped with charred corn and chopped cilantro, lime wedge at the side, served in a shallow bowl. Overhead view, soft natural daylight, clear food texture across the dish, natural colors, no text.",
  },
  {
    id: "fried-rice",
    prompt:
      "Realistic food photograph of vegetable fried rice with distinct grains of rice, peas and diced carrots visible, served on a white plate. Three-quarter angle, natural daylight, sharp detail on the rice grains, natural colors, no text.",
  },
  {
    id: "grilled-steak",
    prompt:
      "Realistic food photograph of sliced grilled steak with grill marks, medium-rare pink center visible on the slices, served on a plate with a small herb garnish. Side angle, natural daylight, clear meat texture, natural colors, no text.",
  },
];

const MODELS = ["flux", "zimage", "seedream5"];

const PARAM_SETS = [
  { name: "minimal", params: { enhance: "false", nologo: "true" } },
  {
    name: "with-negative",
    params: {
      enhance: "false",
      nologo: "true",
      negative_prompt: "blurry, out of focus, soft focus, bokeh, cartoon, text, watermark",
    },
  },
  {
    name: "with-guidance",
    params: {
      enhance: "false",
      nologo: "true",
      negative_prompt: "blurry, out of focus, soft focus, bokeh, cartoon, text, watermark",
      guidance_scale: "7.5",
    },
  },
];

function buildUrl(prompt, model, paramSet) {
  const params = new URLSearchParams({
    width: String(WIDTH),
    height: String(HEIGHT),
    model,
    ...paramSet.params,
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
}

async function analyzeBuffer(label, buffer) {
  const meta = await sharp(buffer).metadata();
  return {
    label,
    bytes: buffer.length,
    format: meta.format,
    width: meta.width,
    height: meta.height,
    hasAlpha: meta.hasAlpha,
  };
}

async function fetchImage(url) {
  const started = Date.now();
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: "image/*" },
  });
  const ms = Date.now() - started;
  const contentType = res.headers.get("content-type") ?? "";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { ok: res.ok, status: res.status, contentType, buffer, ms, url };
}

async function backendPipelineSim(providerBuffer) {
  const reencoded = await sharp(providerBuffer).rotate().jpeg({ quality: 95, mozjpeg: true }).toBuffer();
  return { reencoded };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const report = [];

  for (const testCase of CASES) {
    for (const model of MODELS) {
      const paramSet = PARAM_SETS[0];
      const url = buildUrl(testCase.prompt, model, paramSet);
      const id = `${testCase.id}-${model}-${paramSet.name}`;
      try {
        const fetched = await fetchImage(url);
        if (!fetched.ok || !fetched.contentType.includes("image")) {
          report.push({ id, error: `HTTP ${fetched.status}`, contentType: fetched.contentType, ms: fetched.ms });
          continue;
        }

        const ext =
          fetched.contentType.includes("png") ? ".png" : fetched.contentType.includes("webp") ? ".webp" : ".jpg";
        const providerPath = path.join(OUT_DIR, `${id}.provider${ext}`);
        await writeFile(providerPath, fetched.buffer);

        const { reencoded } = await backendPipelineSim(fetched.buffer);
        const reencodedPath = path.join(OUT_DIR, `${id}.backend-jpeg95.jpg`);
        await writeFile(reencodedPath, reencoded);

        const providerMeta = await analyzeBuffer("provider", fetched.buffer);
        const backendMeta = await analyzeBuffer("backend-jpeg95", reencoded);

        report.push({
          id,
          model,
          caseId: testCase.id,
          paramSet: paramSet.name,
          fetchMs: fetched.ms,
          requested: { width: WIDTH, height: HEIGHT },
          provider: providerMeta,
          backendJpeg95: backendMeta,
          providerPath: path.relative(process.cwd(), providerPath),
          backendPath: path.relative(process.cwd(), reencodedPath),
        });
      } catch (error) {
        report.push({ id, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  await writeFile(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log("Wrote", path.join(OUT_DIR, "report.json"));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
