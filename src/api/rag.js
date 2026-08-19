import api from "./api";

export const searchRAG = async (query, limit, embedding) => {
  try {
    // Pass parameters as an object
    const response = await api.post("/rag/search", {
      query,
      limit,
      embedding,
    });
    return response.data;
  } catch (error) {
    console.error("[RAG API] Error searching vector database:", error);
    throw error;
  }
};
