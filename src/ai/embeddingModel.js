// embeddingModel.js
import { env, pipeline } from "@huggingface/transformers";

let embedder = null;
let loadingPromise = null;
const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

export async function loadEmbeddingModel() {
  if (embedder) return embedder;
  if (loadingPromise) return loadingPromise;
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  env.localModelPath = ""; // Prevents fallback to public/models/
  // console.log("[RAG] Loading:", MODEL_ID);
  loadingPromise = pipeline("feature-extraction", MODEL_ID);
  try {
    embedder = await loadingPromise;
    // console.log("[RAG] MiniLM loaded successfully.");
    return embedder;
  } catch (error) {
    loadingPromise = null;
    console.error("[RAG] MiniLM loading failed:", error);
    throw error;
  }
}

export async function generateEmbedding(text) {
  const model = await loadEmbeddingModel();
  const output = await model(text, {
    pooling: "mean",
    normalize: true,
  });
  // console.log("[RAG] Embedding dimensions:", output.data.length);
  return Array.from(output.data);
}
