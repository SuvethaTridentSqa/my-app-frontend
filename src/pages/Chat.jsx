import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { loadLocalModel } from "../ai/localModel.js";
import { generateEmbedding, loadEmbeddingModel } from "../ai/embeddingModel.js";
import { MdOutlineContentCopy } from "react-icons/md";
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
import { MdDeleteOutline } from "react-icons/md";
import { searchRAG } from "../api/rag.js";

const extractAssistantText = (output) => {
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (first?.generated_text) {
      const generated = first.generated_text;
      if (Array.isArray(generated)) {
        const lastMessage = generated[generated.length - 1];
        if (
          lastMessage?.role === "assistant" &&
          typeof lastMessage.content === "string"
        ) {
          return lastMessage.content.trim();
        }
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
};

export default function Chat() {
  // console.log("[CHAT] Chat component mounted/rendered");
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
  const generatorRef = useRef(null);
  const hasLoadedConversationsRef = useRef(false);
  const loadConversations = useCallback(async () => {
    try {
      // console.log("[CHAT] getChatConversations() starting...");
      setError("");
      const response = await getChatConversations();
      // console.log("[CHAT] getChatConversations() response:", response);
      let list =
        response?.data?.conversations ||
        response?.conversations ||
        response?.data?.data ||
        (Array.isArray(response?.data) ? response.data : []);
      if (!Array.isArray(list)) {
        console.warn(
          "[CHAT] Conversations is not an array, got:",
          typeof list,
          list,
        );
        list = [];
      }
      setConversations(list);
    } catch (err) {
      console.error("[CHAT] Conversation loading failed:", err);
      console.error("[CHAT] Error details:", {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      if (err?.response?.status === 401) {
        console.warn("[CHAT] Session expired, redirecting to login");
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
    if (!conversationId) {
      return;
    }
    try {
      setError("");
      const response = await getConversation(conversationId);
      // console.log("[CHAT] getConversation response:", response);
      let conversation =
        response?.data?.conversation ||
        response?.conversation ||
        response?.data?.data ||
        response?.data;
      if (!conversation || typeof conversation !== "object") {
        console.error(
          "[CHAT] Invalid conversation response structure:",
          JSON.stringify(response, null, 2),
        );
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
      console.error("[CHAT] Error details:", {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      if (err?.response?.status === 401) {
        setError("Your session is no longer valid. Please log in again.");
        return;
      }
      setError(err?.response?.data?.message || "Unable to load conversation.");
    }
  }, []);

  const handleNewChat = useCallback(async () => {
    if (loading || deletingConversation) {
      return;
    }
    try {
      setError("");
      const response = await createChatConversation("New Chat");
      // console.log("[CHAT] createChatConversation response:", response);
      let conversation =
        response?.data?.conversation ||
        response?.conversation ||
        response?.data?.data ||
        response?.data;
      if (!conversation || typeof conversation !== "object") {
        console.error(
          "[CHAT] Invalid response structure:",
          JSON.stringify(response, null, 2),
        );
        throw new Error(
          "Conversation was not created. Backend returned invalid response structure.",
        );
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
      console.error("[CHAT] Error details:", {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      if (err?.response?.status === 401) {
        setError("Your session is no longer valid. Please log in again.");
        return;
      }
      setError(err?.response?.data?.message || "Unable to create new chat.");
    }
  }, [loading, deletingConversation, loadConversations]);

  const conversationHistory = useMemo(() => {
    if (!messages.length) {
      return [];
    }
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
      if (loading) {
        return;
      }
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
        {
          role: "user",
          content: text,
          status: "completed",
        },
      ]);
      setPrompt("");
      try {
        // console.log("[CHAT] Saving pending message...");
        await sendChatMessage({
          prompt: text,
          conversationId,
          assistantResponse: "AI response pending...",
          assistantStatus: "pending",
        });
        // console.log("[CHAT] Pending message saved.");
        if (!generatorRef.current) {
          setLoadingStage("Loading local AI model...");
          // console.log("[AI] Loading local AI model...");
          const generator = await loadLocalModel();
          if (!generator) {
            throw new Error("Local AI model failed to load.");
          }
          generatorRef.current = generator;
          // console.log("[AI] Local AI model loaded.");
        }
        setLoadingStage("Loading document search model...");
        // console.log("[RAG] Loading embedding model...");
        await loadEmbeddingModel();
        // console.log("[RAG] Embedding model ready.");
        setLoadingStage("Searching your documents...");
        // console.log("[RAG] Generating query embedding...");
        const queryEmbedding = await generateEmbedding(text);
        if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
          throw new Error("Query embedding was not generated.");
        }
        // console.log("[RAG] Query embedding generated.", {
        //   dimensions: queryEmbedding.length,
        // });
        // console.log("[RAG] Searching vector database...");
        const ragResponse = await searchRAG(text, 3, queryEmbedding);
        const retrievedChunks = Array.isArray(ragResponse?.results)
          ? ragResponse.results
          : [];
        // console.log("[RAG] Retrieved chunks:", retrievedChunks.length);
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
${chunk.text || ""}
`;
            })
            .join("\n\n");
        }
        const generator = generatorRef.current;
        if (!generator) {
          throw new Error("Local AI model is not ready.");
        }
        setLoadingStage("Generating response...");
        const systemPrompt = `
You are a helpful AI assistant.
You are running locally in the user's browser.
You have access to retrieved information from
the user's documents.
IMPORTANT RULES:
1. Use the retrieved context when it is relevant
   to the user's question.
2. Do not invent facts that are not supported
   by the retrieved context.
3. If the user's question is about the uploaded
   documents and the answer cannot be found in
   the retrieved context, clearly say that the
   information was not found in the documents.
4. Do not pretend that you have real-time
   internet access.
5. Do not claim to know the current time unless
   the application provides the current time
   explicitly.
6. Do not make up dates, events, people,
   documents, or facts.
7. Answer clearly and concisely.
8. When retrieved context is available, prefer
   that information over your general knowledge.
---------------------------------------
RETRIEVED DOCUMENT CONTEXT
---------------------------------------
${ragContext}
---------------------------------------
END RETRIEVED CONTEXT
---------------------------------------
`;
        const modelMessages = [
          {
            role: "system",
            content: systemPrompt,
          },
          ...conversationHistory,
          {
            role: "user",
            content: text,
          },
        ];
        // console.log("[AI] Generating response...");
        const output = await generator(modelMessages, {
          max_new_tokens: 1200,
          do_sample: false,
        });
        // console.log("[AI] Raw model output:", output);
        let assistantText = extractAssistantText(output);
        assistantText = assistantText.trim();
        assistantText = assistantText.replace(/^assistant\s*:?\s*/i, "").trim();
        if (!assistantText) {
          throw new Error("AI returned an empty response.");
        }
        //        console.log("[AI] Final assistant response:", assistantText);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: assistantText,
            status: "completed",
          },
        ]);
        //console.log("[CHAT] Saving successful response...");
        await sendChatMessage({
          prompt: text,
          conversationId,
          assistantResponse: assistantText,
          assistantStatus: "completed",
        });
        // console.log("[CHAT] Response saved.");
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
      conversationHistory,
      loadConversation,
      loadConversations,
    ],
  );

  const copyMessage = async (content, index) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageIndex(index);
      setTimeout(() => {
        setCopiedMessageIndex(null);
      }, 1500);
    } catch (err) {
      console.error("[CHAT] Failed to copy message:", err);
    }
  };
  useEffect(() => {
    if (authLoading) {
      // console.log("[CHAT] Waiting for auth to load...");
      return;
    }
    if (!auth?.isAuthenticated || !auth?.token) {
      console.warn("[CHAT] User not authenticated, skipping conversation load");
      hasLoadedConversationsRef.current = false;
      return;
    }
    if (hasLoadedConversationsRef.current) {
      // console.log(
      //   "[CHAT] Conversations already loaded in this mount, skipping",
      // );
      return;
    }
    // console.log("[CHAT] Auth ready, loading conversations for first time...");
    hasLoadedConversationsRef.current = true;
    loadConversations();
  }, [authLoading, auth?.isAuthenticated, auth?.token]);

  useEffect(() => {
    if (!auth?.isAuthenticated) {
      hasLoadedConversationsRef.current = false;
    }
  }, [auth?.isAuthenticated]);

  useEffect(() => {
    const handleUnauthorized = (event) => {
      console.warn(
        "[CHAT] Received auth:unauthorized event, redirecting to login",
      );
      setError("Your session has expired. Please log in again.");
      setTimeout(() => {
        navigate("/login", { replace: true, state: { expired: true } });
      }, 1000);
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
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

  const handleDeleteConversation = useCallback(async () => {
    if (!deleteConversationTarget?._id) {
      return;
    }
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
                  (message) => message.status === "failed",
                );
                return (
                  <div
                    key={conversation._id}
                    className={`chat-list-item-wrapper ${
                      selectedConversation?._id === conversation._id
                        ? "active"
                        : ""
                    }`}
                  >
                    <button
                      type="button"
                      className={`chat-list-item ${
                        selectedConversation?._id === conversation._id
                          ? "active"
                          : ""
                      }`}
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
                  className={`chat-message ${
                    message.role === "assistant" ? "assistant" : "user"
                  } ${message.status === "failed" ? "failed" : ""}`}
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
                          .map((line) => line.trim())
                          .filter(Boolean);
                        if (!lines.length) {
                          return null;
                        }
                        const isNumberedList = lines.every((line) =>
                          /^\d+[.)]\s+/.test(line),
                        );
                        if (isNumberedList) {
                          return (
                            <ol
                              key={blockIndex}
                              className="message-list numbered-list"
                            >
                              {lines.map((line, itemIndex) => {
                                const text = line.replace(/^\d+[.)]\s+/, "");
                                return (
                                  <li key={itemIndex}>
                                    {formatMessageText(text)}
                                  </li>
                                );
                              })}
                            </ol>
                          );
                        }
                        const isBulletList = lines.every((line) =>
                          /^[-*•]\s+/.test(line),
                        );
                        if (isBulletList) {
                          return (
                            <ul
                              key={blockIndex}
                              className="message-list bullet-list"
                            >
                              {lines.map((line, itemIndex) => {
                                const text = line.replace(/^[-*•]\s+/, "");
                                return (
                                  <li key={itemIndex}>
                                    {formatMessageText(text)}
                                  </li>
                                );
                              })}
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
          <form className="chat-form" onSubmit={handlePromptSubmit}>
            <textarea
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value.slice(0, 2000));
              }}
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
          onClick={() => {
            if (!deletingConversation) {
              setDeleteConversationTarget(null);
            }
          }}
        >
          <div
            className="delete-modal"
            onClick={(event) => event.stopPropagation()}
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
