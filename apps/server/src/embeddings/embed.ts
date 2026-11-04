import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

// Loaded lazily on first real use, not at import time — the model has to be
// downloaded on first run, which tests should never trigger (they mock this
// module entirely; see apps/server/src/router/registry.test.ts and
// src/mcp/route.test.ts).
let extractor: FeatureExtractionPipeline | undefined;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractor) {
    extractor = await pipeline('feature-extraction', EMBEDDING_MODEL);
  }
  return extractor;
}

export async function embedText(text: string): Promise<number[]> {
  const model = await getExtractor();
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}
