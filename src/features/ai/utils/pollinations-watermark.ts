import sharp from "sharp";

export type WatermarkMitigation = {
  nologoRequested: boolean;
  bearerTokenSent: boolean;
  bottomStripCropApplied: boolean;
  cropBottomPx: number;
  providerHeight: number | null;
  servedHeight: number | null;
};

/**
 * Provider free tier often burns "pollinations.ai" into the bottom margin.
 * nologo=true needs a registered account; this crop removes the typical bottom strip for served copies only.
 */
export async function prepareServedRecipeImageBuffer(
  providerBuffer: Buffer,
  options: { nologoRequested: boolean; bearerTokenSent: boolean },
): Promise<{ servedBuffer: Buffer; mitigation: WatermarkMitigation }> {
  const disableCrop = process.env.POLLINATIONS_WATERMARK_CROP === "0";
  const meta = await sharp(providerBuffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  const mitigation: WatermarkMitigation = {
    nologoRequested: options.nologoRequested,
    bearerTokenSent: options.bearerTokenSent,
    bottomStripCropApplied: false,
    cropBottomPx: 0,
    providerHeight: height || null,
    servedHeight: height || null,
  };

  if (disableCrop || width < 64 || height < 64) {
    return { servedBuffer: providerBuffer, mitigation };
  }

  const cropBottomPx = Math.min(Math.max(Math.round(height * 0.075), 44), 72);
  const servedHeight = height - cropBottomPx;
  if (servedHeight < height * 0.85) {
    return { servedBuffer: providerBuffer, mitigation };
  }

  const servedBuffer = await sharp(providerBuffer)
    .extract({ left: 0, top: 0, width, height: servedHeight })
    .toBuffer();

  mitigation.bottomStripCropApplied = true;
  mitigation.cropBottomPx = cropBottomPx;
  mitigation.servedHeight = servedHeight;

  return { servedBuffer, mitigation };
}
