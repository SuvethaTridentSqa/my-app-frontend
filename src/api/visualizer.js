import api from "./api";

export const visualizeLinks = (targetUrl) =>
  api.post("/visualizer/links", {
    targetUrl,
  });
