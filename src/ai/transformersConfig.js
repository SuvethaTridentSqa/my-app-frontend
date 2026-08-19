// transformersConfig.js
import { env } from "@huggingface/transformers";

env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = "/models/";
env.useBrowserCache = false;

console.log("[Transformers] Configuration:", {
  allowLocalModels: env.allowLocalModels,
  allowRemoteModels: env.allowRemoteModels,
  localModelPath: env.localModelPath,
});
