import { useState } from "react";
import { extractDocumentChunks, saveRagDocument } from "../api/rag.js";
import { generateEmbedding, loadEmbeddingModel } from "../ai/embeddingModel.js";
import { FiLoader, FiUploadCloud } from "react-icons/fi";

export default function UploadDocument({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!file) {
      setError("Please choose a file first.");
      return;
    }
    setBusy(true);
    setError("");
    setProgress(0);
    try {
      setStatus("Extracting text...");
      const { title, fileName, chunks } = await extractDocumentChunks(file);
      if (!chunks?.length) {
        throw new Error("No chunks were extracted from this document.");
      }
      setStatus("Loading embedding model...");
      await loadEmbeddingModel();
      setStatus(`Embedding chunks (0/${chunks.length})...`);
      const embeddedChunks = [];
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await generateEmbedding(chunks[i].text);
        embeddedChunks.push({ ...chunks[i], embedding });
        setProgress(Math.round(((i + 1) / chunks.length) * 100));
        setStatus(`Embedding chunks (${i + 1}/${chunks.length})...`);
      }
      setStatus("Saving document...");
      const result = await saveRagDocument({
        title,
        fileName,
        chunks: embeddedChunks,
      });
      setStatus("Document indexed successfully.");
      setFile(null);
      onUploaded?.(result.document);
    } catch (err) {
      console.error("[UPLOAD] Failed:", err);
      setError(
        err?.response?.data?.message || err?.message || "Upload failed.",
      );
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="upload-document-form" onSubmit={handleUpload}>
      <input
        type="file"
        accept=".txt,.pdf,.docx"
        disabled={busy}
        onChange={(event) => setFile(event.target.files?.[0] || null)}
      />
      <button
        className="secondary-button"
        type="submit"
        disabled={busy || !file}
      >
        {busy ? <FiLoader className="animate-spin" /> : <FiUploadCloud />}
      </button>
      {busy && (
        <div className="upload-progress">
          <div
            className="upload-progress-bar"
            style={{ width: `${progress}%` }}
          />
          <small>{status}</small>
        </div>
      )}
      {error && <div className="message-box warn">{error}</div>}
      {!busy && status && !error && <small>{status}</small>}
    </form>
  );
}
