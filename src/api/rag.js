import api from "./api";

export const searchRAG = async (query, limit, embedding, documentId) => {
  try {
    const response = await api.post("/rag/search", {
      query,
      limit,
      embedding,
      documentId,
    });
    return response.data;
  } catch (error) {
    console.error("[RAG API] Error searching vector database:", error);
    throw error;
  }
};

export const extractDocumentChunks = async (file) => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/rag/extract", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  } catch (error) {
    console.error("[RAG API] Error extracting document:", error);
    throw error;
  }
};

export const saveRagDocument = async ({ title, fileName, chunks }) => {
  try {
    const response = await api.post("/rag/documents", {
      title,
      fileName,
      chunks,
    });
    return response.data;
  } catch (error) {
    console.error("[RAG API] Error saving document:", error);
    throw error;
  }
};

export const listRagDocuments = async () => {
  try {
    const response = await api.get("/rag/documents");
    return response.data;
  } catch (error) {
    console.error("[RAG API] Error listing documents:", error);
    throw error;
  }
};

export const deleteRagDocument = async (documentId) => {
  try {
    const response = await api.delete(`/rag/documents/${documentId}`);
    return response.data;
  } catch (error) {
    console.error("[RAG API] Error deleting document:", error);
    throw error;
  }
};
