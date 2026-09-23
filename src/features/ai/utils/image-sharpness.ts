import sharp from "sharp";

/** Laplacian edge kernel — higher variance ≈ sharper image. */
const LAPLACIAN_KERNEL = {
  width: 3,
  height: 3,
  kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
};

const ANALYSIS_SIZE = 640;

function varianceOfBuffer(data: Buffer) {
  let sum = 0;
  let sumSq = 0;
  const n = data.length;
  if (n === 0) return 0;
  for (let i = 0; i < n; i += 1) {
    const v = data[i] ?? 0;
    sum += v;
    sumSq += v * v;
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** Score sharpness (typical AI food blur: &lt;120, acceptable: 180+, crisp catalog photo: 350+). */
export async function measureSharpnessScore(buffer: Buffer) {
  const { data } = await sharp(buffer)
    .greyscale()
    .resize(ANALYSIS_SIZE, ANALYSIS_SIZE, { fit: "inside", kernel: sharp.kernel.lanczos3 })
    .convolve(LAPLACIAN_KERNEL)
    .raw()
    .toBuffer({ resolveWithObject: true });

  return varianceOfBuffer(data);
}

export function passesSharpnessGate(score: number, minimum: number) {
  return score >= minimum;
}
