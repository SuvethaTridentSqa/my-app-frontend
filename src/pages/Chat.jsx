import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { loadLocalModel } from "../ai/localModel.js";
import { generateEmbedding, loadEmbeddingModel } from "../ai/embeddingModel.js";
import { MdOutlineContentCopy, MdDeleteOutline } from "react-icons/md";
import { LuCopyCheck } from "react-icons/lu";
import BackButton from "../components/BackButton";
import UsageBadge from "../components/UsageBadge";
import {
  getChatConversations,
  getConversation,
  createChatConversation,
  sendChatMessage,
  deleteChatConversation,
} from "../api/ai.js";
import { searchRAG, listRagDocuments, deleteRagDocument } from "../api/rag.js";
import UploadDocument from "../components/UploadDocument";

function stripMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_{2}(.*?)_{2}/g, "$1")
    .trim();
}

function extractAssistantText(output) {
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (first?.generated_text) {
      const generated = first.generated_text;
      if (Array.isArray(generated)) {
        const lastMessage = generated[generated.length - 1];
        if (typeof lastMessage?.content === "string") {
          return lastMessage.content.trim();
        }
      }
      if (typeof generated === "string") {
        return generated.trim();
      }
    }
  }
  if (typeof output === "string") {
    return output.trim();
  }
  if (output) {
    try {
      return JSON.stringify(output);
    } catch {
      return "";
    }
  }
  return "";
}

export default function Chat() {
  const navigate = useNavigate();
  const { auth, loading: authLoading } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [error, setError] = useState("");
  const [conversationTitle, setConversationTitle] = useState("New Chat");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [ragSources, setRagSources] = useState([]);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState(null);
  const [deleteConversationTarget, setDeleteConversationTarget] =
    useState(null);
  const [deletingConversation, setDeletingConversation] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [activeDocumentId, setActiveDocumentId] = useState("");

  const generatorRef = useRef(null);
  const hasLoadedConversationsRef = useRef(false);

  const loadDocuments = useCallback(async () => {
    try {
      const response = await listRagDocuments();
      setDocuments(response?.data || []);
    } catch (err) {
      console.error("[CHAT] Failed to load documents:", err);
    }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      setError("");
      const response = await getChatConversations();
      let list =
        response?.data?.conversations ||
        response?.conversations ||
        response?.data?.data ||
        (Array.isArray(response?.data) ? response.data : []);
      if (!Array.isArray(list)) list = [];
      setConversations(list);
    } catch (err) {
      console.error("[CHAT] Conversation loading failed:", err);
      if (err?.response?.status === 401) {
        setError("Your session is no longer valid. Please log in again.");
        setTimeout(() => {
          navigate("/login", { replace: true, state: { expired: true } });
        }, 1000);
        return;
      }
      setError(err?.response?.data?.message || "Unable to load conversations.");
    }
  }, [navigate]);

  const loadConversation = useCallback(async (conversationId) => {
    if (!conversationId) return;
    try {
      setError("");
      const response = await getConversation(conversationId);
      let conversation =
        response?.data?.conversation ||
        response?.conversation ||
        response?.data?.data ||
        response?.data;
      if (!conversation || typeof conversation !== "object") {
        throw new Error("Conversation was not returned.");
      }
      setSelectedConversation(conversation);
      setMessages(
        Array.isArray(conversation.messages) ? conversation.messages : [],
      );
      setConversationTitle(conversation.title || "Chat");
      setRagSources([]);
    } catch (err) {
      console.error("[CHAT] Conversation loading failed:", err);
      if (err?.response?.status === 401) {
        setError("Your session is no longer valid. Please log in again.");
        return;
      }
      setError(err?.response?.data?.message || "Unable to load conversation.");
    }
  }, []);

  const handleNewChat = useCallback(async () => {
    if (loading || deletingConversation) return;
    try {
      setError("");
      const response = await createChatConversation("New Chat");
      let conversation =
        response?.data?.conversation ||
        response?.conversation ||
        response?.data?.data ||
        response?.data;
      if (!conversation || typeof conversation !== "object") {
        throw new Error("Conversation was not created.");
      }
      setSelectedConversation(conversation);
      setMessages([]);
      setPrompt("");
      setConversationTitle("New Chat");
      setElapsedSeconds(0);
      setRagSources([]);
      await loadConversations();
    } catch (err) {
      console.error("[CHAT] New chat creation failed:", err);
      if (err?.response?.status === 401) {
        setError("Your session is no longer valid. Please log in again.");
        return;
      }
      setError(err?.response?.data?.message || "Unable to create new chat.");
    }
  }, [loading, deletingConversation, loadConversations]);

  const conversationHistory = useMemo(() => {
    if (!messages.length) return [];
    return messages.slice(-4).map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: String(message.content || "").slice(0, 1000),
    }));
  }, [messages]);

  const handlePromptSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      const text = prompt.trim();
      if (!text) {
        setError("Please enter a prompt.");
        return;
      }
      if (!selectedConversation?._id) {
        setError("Please create a new chat first.");
        return;
      }
      if (loading) return;

      const conversationId = selectedConversation._id;
      setLoading(true);
      setError("");
      setElapsedSeconds(0);
      setLoadingStage("Preparing AI model...");
      setRagSources([]);
      const startTime = Date.now();
      const timer = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text, status: "completed" },
      ]);
      setPrompt("");

      try {
        await sendChatMessage({
          prompt: text,
          conversationId,
          assistantResponse: "AI response pending...",
          assistantStatus: "pending",
        });

        if (!generatorRef.current) {
          setLoadingStage("Loading local AI model...");
          const generator = await loadLocalModel();
          if (!generator) throw new Error("Local AI model failed to load.");
          generatorRef.current = generator;
        }

        setLoadingStage("Loading document search model...");
        await loadEmbeddingModel();

        setLoadingStage("Searching your documents...");
        const queryEmbedding = await generateEmbedding(text);
        if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
          throw new Error("Query embedding was not generated.");
        }

        const ragResponse = await searchRAG(
          text,
          3,
          queryEmbedding,
          activeDocumentId || undefined,
        );
        const retrievedChunks = Array.isArray(ragResponse?.data)
          ? ragResponse.data
          : [];

        const sources = retrievedChunks.map((chunk, index) => ({
          id: chunk._id || `${index}`,
          fileName:
            chunk?.metadata?.fileName ||
            chunk?.metadata?.source ||
            "Unknown document",
          page: chunk?.metadata?.page || null,
          score: typeof chunk.score === "number" ? chunk.score : null,
          text: chunk.text || "",
        }));
        setRagSources(sources);

        let ragContext =
          "No relevant information was found in the user's documents.";
        if (retrievedChunks.length > 0) {
          ragContext = retrievedChunks
            .map((chunk, index) => {
              const sourceName =
                chunk?.metadata?.fileName ||
                chunk?.metadata?.source ||
                "Unknown document";
              const page = chunk?.metadata?.page;
              return `
SOURCE ${index + 1}
DOCUMENT: ${sourceName}
${page ? `PAGE: ${page}` : ""}
${stripMarkdown(chunk.text || "")}
`;
            })
            .join("\n\n");
        }

        const generator = generatorRef.current;
        if (!generator) throw new Error("Local AI model is not ready.");

        setLoadingStage("Generating response...");
        const userTurnWithContext = `Use the text below to answer the question. If the text does not contain the answer, reply exactly: I don't see that in the document.

TEXT:
${ragContext}

QUESTION: ${text}`;

        const modelMessages = [
          {
            role: "user",
            content: userTurnWithContext,
          },
        ];

        console.log(
          "[AI] Messages sent to model:",
          JSON.stringify(modelMessages, null, 2),
        );

        const output = await generator(modelMessages, {
          max_new_tokens: 300,
          do_sample: false,
        });
        console.log("[AI] Raw model output:", JSON.stringify(output, null, 2));

        let assistantText = extractAssistantText(output);
        assistantText = assistantText
          .trim()
          .replace(/^assistant\s*:?\s*/i, "")
          .trim();
        if (!assistantText) throw new Error("AI returned an empty response.");

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: assistantText, status: "completed" },
        ]);

        await sendChatMessage({
          prompt: text,
          conversationId,
          assistantResponse: assistantText,
          assistantStatus: "completed",
        });

        await loadConversation(conversationId);
        await loadConversations();
      } catch (err) {
        console.error("[AI/RAG] ERROR:", err);
        const errorMessage =
          err?.response?.data?.message ||
          err?.message ||
          "Unable to generate AI response.";
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: errorMessage,
            status: "failed",
            failed: true,
          },
        ]);
        try {
          await sendChatMessage({
            prompt: text,
            conversationId,
            assistantResponse: errorMessage,
            assistantStatus: "failed",
          });
          await loadConversation(conversationId);
          await loadConversations();
        } catch (saveError) {
          console.error("[CHAT] Failed to save failed AI message:", saveError);
          setError("AI failed and the failed message could not be saved.");
          return;
        }
        setError(`AI response failed: ${errorMessage}`);
      } finally {
        clearInterval(timer);
        setLoading(false);
        setLoadingStage("");
        setElapsedSeconds(0);
      }
    },
    [
      selectedConversation,
      prompt,
      loading,
      activeDocumentId,
      loadConversation,
      loadConversations,
    ],
  );

  const copyMessage = async (content, index) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageIndex(index);
      setTimeout(() => setCopiedMessageIndex(null), 1500);
    } catch (err) {
      console.error("[CHAT] Failed to copy message:", err);
    }
  };

  const handleDeleteDocument = useCallback(async () => {
    if (!activeDocumentId) {
      setError("Select a document from the dropdown first.");
      return;
    }
    const docToDelete = documents.find((d) => d._id === activeDocumentId);
    const confirmed = window.confirm(
      `Delete "${docToDelete?.title || "this document"}"? This cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      await deleteRagDocument(activeDocumentId);
      setActiveDocumentId("");
      await loadDocuments();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete document.");
    }
  }, [activeDocumentId, documents, loadDocuments]);

  const handleDeleteConversation = useCallback(async () => {
    if (!deleteConversationTarget?._id) return;
    try {
      setDeletingConversation(true);
      setError("");
      const deletedId = deleteConversationTarget._id;
      await deleteChatConversation(deletedId);
      setDeleteConversationTarget(null);
      if (selectedConversation?._id === deletedId) {
        setSelectedConversation(null);
        setMessages([]);
        setConversationTitle("New Chat");
        setRagSources([]);
        setPrompt("");
      }
      await loadConversations();
    } catch (err) {
      console.error("[CHAT] Failed to delete conversation:", err);
      setError(
        err?.response?.data?.message || "Unable to delete conversation.",
      );
    } finally {
      setDeletingConversation(false);
    }
  }, [deleteConversationTarget, selectedConversation, loadConversations]);

  useEffect(() => {
    if (authLoading) return;
    if (!auth?.isAuthenticated || !auth?.token) {
      hasLoadedConversationsRef.current = false;
      return;
    }
    if (hasLoadedConversationsRef.current) return;
    hasLoadedConversationsRef.current = true;
    loadConversations();
    loadDocuments();
  }, [
    authLoading,
    auth?.isAuthenticated,
    auth?.token,
    loadConversations,
    loadDocuments,
  ]);

  useEffect(() => {
    if (!auth?.isAuthenticated) {
      hasLoadedConversationsRef.current = false;
    }
  }, [auth?.isAuthenticated]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setError("Your session has expired. Please log in again.");
      setTimeout(() => {
        navigate("/login", { replace: true, state: { expired: true } });
      }, 1000);
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () =>
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, [navigate]);

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const formatMessageText = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) {
        return <strong key={index}>{part.replace(/^\*\*|\*\*$/g, "")}</strong>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <section className="page-content chat-page">
      <BackButton onClick={() => navigate(-1)} />
      <header className="page-header">
        <div>
          <h2>AI Chat</h2>
          <p>Ask questions, get answers, and keep your conversation history.</p>
        </div>
        <UsageBadge count={conversations.length} />
      </header>
      <div className="chat-grid">
        <aside className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h3>Conversations</h3>
            <button
              className="secondary-button"
              type="button"
              onClick={handleNewChat}
              disabled={loading || deletingConversation}
            >
              + New
            </button>
          </div>
          <div className="chat-list">
            {conversations.length === 0 ? (
              <div className="message-empty">No conversations yet.</div>
            ) : (
              conversations.map((conversation) => {
                const hasFailedMessage = conversation.messages?.some(
                  (m) => m.status === "failed",
                );
                return (
                  <div
                    key={conversation._id}
                    className={`chat-list-item-wrapper ${selectedConversation?._id === conversation._id ? "active" : ""}`}
                  >
                    <button
                      type="button"
                      className={`chat-list-item ${selectedConversation?._id === conversation._id ? "active" : ""}`}
                      onClick={() => loadConversation(conversation._id)}
                      disabled={loading || deletingConversation}
                    >
                      <span>
                        {conversation.title || "Untitled Chat"}
                        {hasFailedMessage && (
                          <span
                            style={{
                              color: "#d9534f",
                              fontWeight: "700",
                              marginLeft: "8px",
                            }}
                            title="AI response failed"
                          >
                            ✕
                          </span>
                        )}
                      </span>
                      <small>
                        {conversation.updatedAt
                          ? new Date(conversation.updatedAt).toLocaleString()
                          : ""}
                      </small>
                    </button>
                    <button
                      type="button"
                      className="delete-chat-button"
                      title={`Delete ${conversation.title || "Chat"}`}
                      aria-label={`Delete ${conversation.title || "Chat"}`}
                      disabled={loading || deletingConversation}
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleteConversationTarget(conversation);
                      }}
                    >
                      <MdDeleteOutline />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <main className="chat-main">
          <div className="chat-main-header">
            <h3>{conversationTitle}</h3>
          </div>
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="message-empty">
                Start a conversation with the AI.
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={`msg-${selectedConversation?._id}-${index}`}
                  className={`chat-message ${message.role === "assistant" ? "assistant" : "user"} ${message.status === "failed" ? "failed" : ""}`}
                >
                  <div className="message-role">
                    {message.status === "failed" ? "AI Failed" : message.role}
                  </div>
                  <div className="message-content">
                    {String(message.content || "")
                      .split(/\n\s*\n/)
                      .map((block, blockIndex) => {
                        const lines = block
                          .split("\n")
                          .map((l) => l.trim())
                          .filter(Boolean);
                        if (!lines.length) return null;
                        const isNumberedList = lines.every((l) =>
                          /^\d+[.)]\s+/.test(l),
                        );
                        if (isNumberedList) {
                          return (
                            <ol
                              key={blockIndex}
                              className="message-list numbered-list"
                            >
                              {lines.map((line, i) => (
                                <li key={i}>
                                  {formatMessageText(
                                    line.replace(/^\d+[.)]\s+/, ""),
                                  )}
                                </li>
                              ))}
                            </ol>
                          );
                        }
                        const isBulletList = lines.every((l) =>
                          /^[-*•]\s+/.test(l),
                        );
                        if (isBulletList) {
                          return (
                            <ul
                              key={blockIndex}
                              className="message-list bullet-list"
                            >
                              {lines.map((line, i) => (
                                <li key={i}>
                                  {formatMessageText(
                                    line.replace(/^[-*•]\s+/, ""),
                                  )}
                                </li>
                              ))}
                            </ul>
                          );
                        }
                        return (
                          <p key={blockIndex} className="message-paragraph">
                            {formatMessageText(block)}
                          </p>
                        );
                      })}
                  </div>
                  {message.role === "assistant" && !message.failed && (
                    <button
                      type="button"
                      className="copy-message-button"
                      onClick={() => copyMessage(message.content, index)}
                      aria-label="Copy AI response"
                    >
                      {copiedMessageIndex === index ? (
                        <>
                          <span className="copy-icon">
                            <LuCopyCheck />
                          </span>{" "}
                          Copied
                        </>
                      ) : (
                        <>
                          <span className="copy-icon">
                            <MdOutlineContentCopy />
                          </span>{" "}
                          Copy
                        </>
                      )}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {ragSources.length > 0 && (
            <div className="rag-sources">
              <strong>Sources</strong>
              <div className="rag-sources-list">
                {ragSources.map((source, index) => (
                  <div key={source.id || index} className="rag-source-item">
                    <div>
                      <strong>
                        {index + 1}. {source.fileName}
                      </strong>
                      {source.page && <span> — Page {source.page}</span>}
                    </div>
                    {source.score !== null && (
                      <small>
                        Relevance: {(source.score * 100).toFixed(1)}%
                      </small>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <div className="message-box warn">{error}</div>}
          {loading && (
            <div className="message-box">
              AI is working...
              <br />
              {loadingStage || "Processing..."}
              <br />
              Elapsed time: {elapsedSeconds}s
            </div>
          )}

          <div className="rag-document-picker">
            <label htmlFor="doc-picker">Ask about:</label>
            <select
              id="doc-picker"
              value={activeDocumentId}
              onChange={(e) => setActiveDocumentId(e.target.value)}
            >
              <option value="">All documents (may mix results)</option>
              {documents.map((doc) => (
                <option key={doc._id} value={doc._id}>
                  {doc.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="secondary-button"
              onClick={handleDeleteDocument}
              disabled={!activeDocumentId}
              title="Delete selected document"
            >
              🗑 Delete
            </button>
          </div>

          <UploadDocument
            onUploaded={async (uploadedDocument) => {
              await loadDocuments();
              if (uploadedDocument?._id)
                setActiveDocumentId(uploadedDocument._id);
            }}
          />

          <form className="chat-form" onSubmit={handlePromptSubmit}>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value.slice(0, 2000))}
              placeholder="Type your Questions here..."
              rows={3}
              disabled={loading}
              onKeyDown={handleKeyDown}
            />
            <small>{prompt.length}/2000 characters</small>
            <button
              className="primary-button send-button"
              type="submit"
              disabled={loading || !prompt.trim() || !selectedConversation?._id}
            >
              {loading ? `Generating... ${elapsedSeconds}s` : "Send"}
            </button>
          </form>
        </main>
      </div>

      {deleteConversationTarget && (
        <div
          className="delete-modal-overlay"
          onClick={() =>
            !deletingConversation && setDeleteConversationTarget(null)
          }
        >
          <div
            className="delete-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-chat-title"
          >
            <h3 id="delete-chat-title">Delete Chat</h3>
            <p>
              Are you sure you want to delete{" "}
              <strong>{deleteConversationTarget.title || "this chat"}</strong>?
            </p>
            <div className="delete-modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDeleteConversationTarget(null)}
                disabled={deletingConversation}
              >
                Cancel
              </button>
              <button
                type="button"
                className="delete-confirm-button"
                onClick={handleDeleteConversation}
                disabled={deletingConversation}
              >
                {deletingConversation ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
