import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadLocalModel } from "../ai/localModel.js";
import BackButton from "../components/BackButton";
import UsageBadge from "../components/UsageBadge";
import {
  getChatConversations,
  getConversation,
  createChatConversation,
  sendChatMessage,
} from "../api/ai.js";

export default function Chat() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [conversationTitle, setConversationTitle] = useState("New Chat");

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const navigate = useNavigate();

  // ---------------------------------------
  // LOAD CONVERSATIONS FROM MONGODB
  // ---------------------------------------

  const loadConversations = async () => {
    try {
      setError("");

      const response = await getChatConversations();

      const list = response?.data?.conversations || [];

      console.log("Loaded conversations:", list);

      setConversations(list);
    } catch (err) {
      console.error("Conversation loading failed:", err);

      setError(err?.response?.data?.message || "Unable to load conversations.");
    }
  };

  // ---------------------------------------
  // LOAD ONE CONVERSATION
  // ---------------------------------------

  const loadConversation = async (conversationId) => {
    try {
      setError("");

      const response = await getConversation(conversationId);

      const conversation = response?.data?.conversation;

      if (!conversation) {
        throw new Error("Conversation was not returned.");
      }

      setSelectedConversation(conversation);

      setMessages(conversation.messages || []);

      setConversationTitle(conversation.title || "Chat");
    } catch (err) {
      console.error("Conversation loading failed:", err);

      setError(err?.response?.data?.message || "Unable to load conversation.");
    }
  };

  // ---------------------------------------
  // NEW CHAT
  // ---------------------------------------

  const handleNewChat = async () => {
    try {
      setError("");

      const response = await createChatConversation("New Chat");

      const conversation = response?.data?.conversation;

      if (!conversation) {
        throw new Error("Conversation was not created.");
      }

      setSelectedConversation(conversation);
      setMessages([]);
      setPrompt("");
      setConversationTitle("New Chat");
      setElapsedSeconds(0);

      await loadConversations();
    } catch (err) {
      console.error("New chat creation failed:", err);

      setError(err?.response?.data?.message || "Unable to create new chat.");
    }
  };

  // ---------------------------------------
  // SEND MESSAGE
  // ---------------------------------------

  const handlePromptSubmit = async (event) => {
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

    const startTime = Date.now();

    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    // Show user message immediately
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
      console.log("Loading local AI model...");

      const generator = await loadLocalModel();

      console.log("Local AI model loaded.");

      // ---------------------------------------
      // GENERATE RESPONSE
      // ---------------------------------------

      const output = await generator(
        [
          {
            role: "system",
            content: "You are a helpful assistant.",
          },
          {
            role: "user",
            content: text,
          },
        ],
        {
          max_new_tokens: 1000,
          do_sample: false,
        },
      );

      console.log("Raw AI output:", output);

      let assistantText = "";

      if (Array.isArray(output) && output[0]?.generated_text) {
        const generated = output[0].generated_text;

        if (Array.isArray(generated)) {
          const lastMessage = generated[generated.length - 1];

          assistantText = lastMessage?.content || "";
        } else {
          assistantText = generated;
        }
      } else if (typeof output === "string") {
        assistantText = output;
      } else {
        assistantText = JSON.stringify(output);
      }

      if (!assistantText.trim()) {
        throw new Error("AI returned an empty response.");
      }

      // ---------------------------------------
      // SHOW ASSISTANT RESPONSE
      // ---------------------------------------

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: assistantText,
          status: "completed",
        },
      ]);

      // ---------------------------------------
      // SAVE SUCCESSFUL CHAT
      // ---------------------------------------

      await sendChatMessage({
        prompt: text,
        conversationId: selectedConversation._id,
        assistantResponse: assistantText,
        assistantStatus: "completed",
      });

      await loadConversation(selectedConversation._id);
      await loadConversations();
    } catch (err) {
      console.error("LOCAL AI ERROR:", err);

      const errorMessage = err?.message || "Unable to generate AI response.";

      // ---------------------------------------
      // SHOW FAILED MESSAGE
      // ---------------------------------------

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errorMessage,
          status: "failed",
          failed: true,
        },
      ]);

      // ---------------------------------------
      // SAVE FAILED CHAT
      // ---------------------------------------

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
        console.error("Failed to save failed AI message:", saveError);

        setError("AI failed and the failed message could not be saved.");
        return;
      }

      setError("AI response failed.");
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  };

  // ---------------------------------------
  // INITIAL PAGE LOAD
  // ---------------------------------------

  useEffect(() => {
    loadConversations();
  }, []);

  // ---------------------------------------
  // UI
  // ---------------------------------------

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
        {/* SIDEBAR */}

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

        {/* CHAT */}

        <main className="chat-main">
          <div className="chat-main-header">
            <h3>{conversationTitle}</h3>
          </div>

          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="message-empty">
                Start a conversation with the AI,Always try with New Chat first.
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`chat-message ${
                    message.role === "assistant" ? "assistant" : "user"
                  } ${message.status === "failed" ? "failed" : ""}`}
                >
                  <div className="message-role">
                    {message.status === "failed" ? " AI Failed" : message.role}
                  </div>

                  <div className="message-content">{message.content}</div>
                </div>
              ))
            )}
          </div>

          {/* ERROR */}

          {error && <div className="message-box warn">{error}</div>}

          {/* LOADING */}

          {loading && (
            <div className="message-box">
              AI is generating a response...
              <br />
              Elapsed time: {elapsedSeconds}s
              <br />
              The first request may take several minutes while the local model
              loads.
            </div>
          )}

          {/* INPUT */}

          <form className="chat-form" onSubmit={handlePromptSubmit}>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Type your question here..."
              rows={3}
              disabled={loading}
            />

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
