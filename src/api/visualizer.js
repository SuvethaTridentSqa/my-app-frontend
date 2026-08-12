import api from "./axios";

export const visualizeLinks = (targetUrl) =>
  api.post("/visualizer/links", {
    targetUrl,
  });
