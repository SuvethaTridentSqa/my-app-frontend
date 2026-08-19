import { env, pipeline } from "@huggingface/transformers";
import "./transformersConfig";

const MODEL_ID = "onnx-community/granite-4.0-350m-ONNX-web";
let generator = null;
let loadingPromise = null;
// env.logLevel = "info";
// env.allowLocalModels = true;
// env.allowRemoteModels = true;
// env.localModelPath = "/models/";
export async function loadLocalModel() {
  if (generator) {
    return generator;
  }
  if (loadingPromise) {
    return loadingPromise;
  }
  loadingPromise = (async () => {
    try {
      // console.log("[AI] Loading Granite...");
      // console.log("[AI] Model:", MODEL_ID);
      // console.log("[AI] Local path:", env.localModelPath);
      if (!navigator.gpu) {
        throw new Error("WebGPU is not available.");
      }
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        throw new Error("WebGPU adapter could not be created.");
      }
      try {
        generator = await pipeline("text-generation", MODEL_ID, {
          device: "webgpu",
          dtype: "q4",
        });
      } catch (error) {
        // console.error("[AI] PIPELINE ERROR:", error);
        console.error("[AI] PIPELINE ERROR MESSAGE:", error?.message);
        // console.error("[AI] PIPELINE ERROR STACK:", error?.stack);
        throw error;
      }
      // console.log("[AI] Granite loaded successfully.");
      return generator;
    } catch (error) {
      console.error("[AI] Granite loading failed:", error);
      loadingPromise = null;
      throw error;
    }
  })();
  return loadingPromise;
}
