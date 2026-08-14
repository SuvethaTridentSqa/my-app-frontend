import { env, pipeline } from "@huggingface/transformers";

const MODEL_ID = "onnx-community/granite-4.0-350m-ONNX-web";

env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = "/models/";

let generator = null;
let loadingPromise = null;

// console.log("======================================");
// console.log("LOCAL AI INITIALIZATION");
// console.log("======================================");
// console.log("[AI] MODEL_ID:", MODEL_ID);
// console.log("[AI] localModelPath:", env.localModelPath);
// console.log("[AI] allowLocalModels:", env.allowLocalModels);
// console.log("[AI] allowRemoteModels:", env.allowRemoteModels);

export async function loadLocalModel() {
  if (generator) {
    console.log("[AI] Using already loaded model.");
    return generator;
  }

  if (loadingPromise) {
    console.log("[AI] Model is already loading...");
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      // console.log("======================================");
      // console.log("[AI] STARTING MODEL LOAD");
      // console.log("======================================");

      const configUrl =
        "/models/onnx-community/granite-4.0-350m-ONNX-web/config.json";
      // console.log("[AI] Checking:", configUrl);
      const response = await fetch(configUrl);
      // console.log("[AI] status:", response.status);
      // console.log("[AI] content-type:", response.headers.get("content-type"));

      if (!response.ok) {
        throw new Error(`config.json returned HTTP ${response.status}`);
      }
      const text = await response.text();
      // console.log("[AI] first 100 chars:", text.substring(0, 100));
      if (
        text.trim().startsWith("<!doctype") ||
        text.trim().startsWith("<html")
      ) {
        throw new Error(
          "config.json is returning index.html. Put the model under public/models/.",
        );
      }

      JSON.parse(text);
      // console.log("[AI] config.json is valid.");
      // console.log("======================================");
      // console.log("[AI] Loading Transformers.js pipeline...");
      // console.log("======================================");

      const modelUrl =
        "/models/onnx-community/granite-4.0-350m-ONNX-web/onnx/model_q4.onnx";

      const dataUrl =
        "/models/onnx-community/granite-4.0-350m-ONNX-web/onnx/model_q4.onnx_data";

      // console.log("[AI] Checking ONNX model files...");

      const modelResponse = await fetch(modelUrl, {
        method: "HEAD",
      });

      const dataResponse = await fetch(dataUrl, {
        method: "HEAD",
      });

      // console.log(
      //   "[AI] model_q4.onnx:",
      //   modelResponse.status,
      //   modelResponse.headers.get("content-length"),
      //   modelResponse.headers.get("content-type"),
      //  );

      // console.log(
      //   "[AI] model_q4.onnx_data:",
      //   dataResponse.status,
      //   dataResponse.headers.get("content-length"),
      //   dataResponse.headers.get("content-type"),
      // );
      // console.log("[AI] WebGPU available:", !!navigator.gpu);

      if (navigator.gpu) {
        const adapter = await navigator.gpu.requestAdapter();
        //        console.log("[AI] WebGPU adapter:", adapter);
      }

      const startTime = Date.now();
      async function inspectBinary(url, name) {
        const response = await fetch(url);
        //        console.log(`[AI] ${name} status:`, response.status);
        // console.log(
        //   `[AI] ${name} content-type:`,
        //   response.headers.get("content-type"),
        // );
        const buffer = await response.arrayBuffer();
        // console.log(`[AI] ${name} bytes:`, buffer.byteLength);
        const bytes = new Uint8Array(buffer.slice(0, 32));
        // console.log(
        //   `[AI] ${name} first bytes:`,
        //   Array.from(bytes)
        //     .map((b) => b.toString(16).padStart(2, "0"))
        //     .join(" "),
        // );

        return buffer;
      }

      // const model = await pipeline("text-generation", MODEL_ID, {
      //   device: "webgpu",
      //   dtype: "q4",
      // });
      const model = await pipeline("text-generation", MODEL_ID, {
        device: "webgpu",
        dtype: "q4",
      });
      const seconds = ((Date.now() - startTime) / 1000).toFixed(1);
      // console.log(`[AI] MODEL LOADED SUCCESSFULLY in ${seconds}s`);
      generator = model;
      return generator;
    } catch (error) {
      // console.error("======================================");
      // console.error("[AI] MODEL LOAD FAILED");
      // console.error("======================================");
      // console.error("[AI] name:", error?.name);
      console.error("[AI] message:", error?.message);
      // console.error("[AI] stack:", error?.stack);
      loadingPromise = null;
      throw error;
    }
  })();

  return loadingPromise;
}
