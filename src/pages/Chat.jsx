import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
} from "../api/ai.js";
import { searchRAG } from "../api/rag.js";

export default function Chat() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [conversationTitle, setConversationTitle] = useState("New Chat");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [ragSources, setRagSources] = useState([]);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState(null);
  const navigate = useNavigate();
  const generatorRef = useRef(null);
  // LOAD ALL CONVERSATIONS
  const loadConversations = useCallback(async () => {
    try {
      setError("");
      const response = await getChatConversations();
      const list = response?.data?.conversations || [];
      // console.log("[CHAT] Loaded conversations:", list);
      setConversations(list);
    } catch (err) {
      // console.error("[CHAT] Conversation loading failed:", err);
      setError(err?.response?.data?.message || "Unable to load conversations.");
    }
  }, []);

  // LOAD ONE CONVERSATION
  const loadConversation = useCallback(async (conversationId) => {
    try {
      setError("");
      const response = await getConversation(conversationId);
      const conversation = response?.data?.conversation;
      if (!conversation) {
        throw new Error("Conversation was not returned.");
      }
      // console.log("[CHAT] Loaded conversation:", conversation);
      setSelectedConversation(conversation);
      setMessages(conversation.messages || []);
      setConversationTitle(conversation.title || "Chat");
      setRagSources([]);
    } catch (err) {
      // console.error("[CHAT] Conversation loading failed:", err);
      setError(err?.response?.data?.message || "Unable to load conversation.");
    }
  }, []);

  const handleNewChat = useCallback(async () => {
    try {
      setError("");
      const response = await createChatConversation("New Chat");
      const conversation = response?.data?.conversation;
      if (!conversation) {
        throw new Error("Conversation was not created.");
      }
      // console.log("[CHAT] New conversation:", conversation);
      setSelectedConversation(conversation);
      setMessages([]);
      setPrompt("");
      setConversationTitle("New Chat");
      setElapsedSeconds(0);
      setRagSources([]);
      await loadConversations();
    } catch (err) {
      // console.error("[CHAT] New chat creation failed:", err);
      setError(err?.response?.data?.message || "Unable to create new chat.");
    }
  }, [loadConversations]);

  const extractAssistantText = (output) => {
    // console.log("[AI] Raw output:", output);
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
      setLoading(true);
      setError("");
      setElapsedSeconds(0);
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
      if (!generatorRef.current) {
        // console.log("[AI] Loading local AI models...");
        const [generator] = await Promise.all([
          loadLocalModel(),
          loadEmbeddingModel(),
        ]);
        generatorRef.current = generator;
        // console.log("[AI] Local AI models loaded.");
      }
      try {
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
        const retrievedChunks = ragResponse?.results || [];
        // console.log("[RAG] Retrieved chunks:", retrievedChunks);
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
                chunk?.metadata?.fileName || "Unknown document";
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
        // console.log("[RAG] CONTEXT SENT TO GRANITE:");
        // console.log(ragContext);
        console.log("[AI] Loading local AI model...");
        // const generator = await loadLocalModel(); //temporarily commended this
        const generator = generatorRef.current;
        if (!generator) {
          throw new Error("Local AI model is not ready.");
        }
        // console.log("[AI] Local AI model loaded.");
        // console.log("[CHAT] Conversation history:", conversationHistory);
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
        // console.log("[AI] System prompt created.");
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
        // console.log("[AI] Messages sent to model:", modelMessages);
        // console.log("[AI] Generating response...");
        const output = await generator(modelMessages, {
          max_new_tokens: 1200,
          do_sample: false,
        });
        // console.log("[AI] Raw model output:", output);
        let assistantText = extractAssistantText(output);
        assistantText = assistantText.trim();
        if (assistantText.startsWith("assistant")) {
          assistantText = assistantText
            .replace(/^assistant\s*:?\s*/i, "")
            .trim();
        }
        if (assistantText.startsWith("Assistant:")) {
          assistantText = assistantText.replace(/^Assistant:\s*/i, "").trim();
        }
        if (!assistantText) {
          throw new Error("AI returned an empty response.");
        }
        // console.log("[AI] Final assistant response:", assistantText);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: assistantText,
            status: "completed",
          },
        ]);
        // console.log("[CHAT] Saving successful response...");
        await sendChatMessage({
          prompt: text,
          conversationId: selectedConversation._id,
          assistantResponse: assistantText,
          assistantStatus: "completed",
        });
        // console.log("[CHAT] Response saved.");
        await loadConversation(selectedConversation._id);
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
            conversationId: selectedConversation._id,
            assistantResponse: errorMessage,
            assistantStatus: "failed",
          });
          await loadConversation(selectedConversation._id);
          await loadConversations();
        } catch (saveError) {
          console.error("[CHAT] Failed to save failed AI message:", saveError);
          setError("AI failed and the failed message could not be saved.");
          return;
        }
        setError("AI response failed.");
      } finally {
        clearInterval(timer);
        setLoading(false);
      }
    },
    [
      selectedConversation,
      prompt,
      messages,
      conversationHistory,
      loadConversation,
      loadConversations,
    ],
  );

  const benchmarkLocalModel = async () => {
    const generator = await loadLocalModel();
    const messages = [
      {
        role: "user",
        content: "Explain quantum computing in three short sentences.",
      },
    ];
    await generator(messages, {
      max_new_tokens: 1000,
      do_sample: false,
    });
    const results = [];
    for (let i = 1; i <= 5; i++) {
      const start = performance.now();
      const output = await generator(messages, {
        max_new_tokens: 100,
        do_sample: false,
      });
      const end = performance.now();
      const seconds = (end - start) / 1000;
      // console.log(`Run ${i}: ${seconds.toFixed(3)}s`);
      results.push(seconds);
    }
    const average = results.reduce((a, b) => a + b, 0) / results.length;
    // console.log(`Average: ${average.toFixed(3)}s`);
    return {
      runs: results,
      average,
    };
  };

  const copyMessage = async (content, index) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageIndex(index);

      setTimeout(() => {
        setCopiedMessageIndex(null);
      }, 1500);
    } catch (err) {
      console.error("Failed to copy message:", err);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

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
              disabled={loading}
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
                  <button
                    key={conversation._id}
                    type="button"
                    className={`chat-list-item ${
                      selectedConversation?._id === conversation._id
                        ? "active"
                        : ""
                    }`}
                    onClick={() => loadConversation(conversation._id)}
                    disabled={loading}
                  >
                    <span>
                      {conversation.title}
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
                    {message.status === "failed" ? " AI Failed" : message.role}
                  </div>
                  {/* <div className="message-content">
                    {message.content
                      .split(/\n\s*\n/)
                      .map((block, blockIndex) => {
                        const lines = block
                          .split("\n")
                          .map((line) => line.trim())
                          .filter(Boolean);
                        if (!lines.length) return null;
                        const isNumberedList = lines.every((line) =>
                          /^\d+[.)]\s+/.test(line),
                        );
                        if (isNumberedList) {
                          return (
                            <ol
                              key={blockIndex}
                              className="message-list numbered-list"
                            >
                              {lines.map((line, index) => {
                                const text = line.replace(/^\d+[.)]\s+/, "");
                                return (
                                  <li key={index}>{formatMessageText(text)}</li>
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
                              {lines.map((line, index) => {
                                const text = line.replace(/^[-*•]\s+/, "");
                                return (
                                  <li key={index}>{formatMessageText(text)}</li>
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
                  </div> */}
                  <div className="message-content">
                    {message.content
                      .split(/\n\s*\n/)
                      .map((block, blockIndex) => {
                        const lines = block
                          .split("\n")
                          .map((line) => line.trim())
                          .filter(Boolean);
                        if (!lines.length) return null;
                        const isNumberedList = lines.every((line) =>
                          /^\d+[.)]\s+/.test(line),
                        );

                        if (isNumberedList) {
                          return (
                            <ol
                              key={blockIndex}
                              className="message-list numbered-list"
                            >
                              {lines.map((line, index) => {
                                const text = line.replace(/^\d+[.)]\s+/, "");
                                return (
                                  <li key={index}>{formatMessageText(text)}</li>
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
                              {lines.map((line, index) => {
                                const text = line.replace(/^[-*•]\s+/, "");
                                return (
                                  <li key={index}>{formatMessageText(text)}</li>
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

                  {/* Copy button only for AI responses */}
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
              <strong> Sources</strong>
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
              AI is generating a response...
              <br />
              Elapsed time: {elapsedSeconds}s
              <br />
              Searching documents and generating the answer...
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
              disabled={loading || !prompt.trim()}
            >
              {loading ? `Generating... ${elapsedSeconds}s` : "Send"}
            </button>
          </form>
        </main>
      </div>
    </section>
  );
}
