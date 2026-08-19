import { useState } from "react";
import { generateEmbedding } from "../ai/embeddingModel.js";
import { uploadRagDocument } from "../api/rag.js";

export default function Documents() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const text = await file.text();
      const chunks = [];
      const chunkSize = 1000;
      for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.slice(i, i + chunkSize));
      }
      const processedChunks = [];
      for (const chunk of chunks) {
        const embedding = await generateEmbedding(chunk);
        processedChunks.push({
          text: chunk,
          embedding,
        });
      }
      await uploadRagDocument({
        title: file.name,
        fileName: file.name,
        chunks: processedChunks,
      });
      alert("Document indexed successfully.");
    } catch (error) {
      console.error(error);
      alert("Document indexing failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2>RAG Documents</h2>
      <input type="file" onChange={(event) => setFile(event.target.files[0])} />
      <button onClick={handleUpload} disabled={!file || loading}>
        {loading ? "Indexing..." : "Upload & Index"}
      </button>
    </section>
  );
}
