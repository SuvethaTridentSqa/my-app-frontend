jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => ({
    auth: { isAuthenticated: true, accessToken: "token" },
    loading: false,
  }),
}));

jest.mock("../ai/localModel.js", () => ({
  loadLocalModel: (...args) => mockLoadLocalModel(...args),
}));

jest.mock("../ai/embeddingModel.js", () => ({
  generateEmbedding: (...args) => mockGenerateEmbedding(...args),
  loadEmbeddingModel: (...args) => mockLoadEmbeddingModel(...args),
}));

jest.mock("../api/ai.js", () => ({
  getChatConversations: (...args) => mockGetChatConversations(...args),
  getConversation: (...args) => mockGetConversation(...args),
  createChatConversation: (...args) => mockCreateChatConversation(...args),
  sendChatMessage: (...args) => mockSendChatMessage(...args),
  deleteChatConversation: jest.fn(),
}));

jest.mock("../api/rag.js", () => ({
  searchRAG: (...args) => mockSearchRAG(...args),
  listRagDocuments: jest.fn(),
  deleteRagDocument: jest.fn(),
}));

jest.mock("../components/BackButton", () => () => null);
jest.mock("../components/UsageBadge", () => () => null);
jest.mock("../components/UploadDocument", () => () => null);

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { listRagDocuments } from "../api/rag.js";
import Chat from "./Chat.jsx";

const mockLoadLocalModel = jest.fn();
const mockGenerateEmbedding = jest.fn();
const mockLoadEmbeddingModel = jest.fn();
const mockGetChatConversations = jest.fn();
const mockGetConversation = jest.fn();
const mockCreateChatConversation = jest.fn();
const mockSendChatMessage = jest.fn();
const mockSearchRAG = jest.fn();

let conversationMessages;
let generatedAnswer;
let generator;

function renderChat() {
  return render(<Chat />);
}

async function startConversation(user) {
  await user.click(screen.getByRole("button", { name: "+ New" }));
  await screen.findByRole("button", { name: "Send" });
}

async function submitPrompt(user, text) {
  const input = screen.getByPlaceholderText("Type your Questions here...");
  await user.type(input, text);
  await user.click(screen.getByRole("button", { name: "Send" }));
}

describe("Chat response and context handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    conversationMessages = [];
    generatedAnswer = "Grounded answer from the document.";
    generator = jest.fn(async () => [
      {
        generated_text: [
          { role: "assistant", content: generatedAnswer },
        ],
      },
    ]);

    mockLoadLocalModel.mockResolvedValue(generator);
    mockGenerateEmbedding.mockResolvedValue([0.25, 0.75]);
    mockLoadEmbeddingModel.mockResolvedValue({});
    mockGetChatConversations.mockResolvedValue({ data: [] });
    mockGetConversation.mockImplementation(async (id) => ({
      data: {
        _id: id,
        title: "Test conversation",
        messages: [...conversationMessages],
      },
    }));
    mockCreateChatConversation.mockResolvedValue({
      data: { _id: "conversation-1", title: "New Chat" },
    });
    mockSendChatMessage.mockImplementation(
      async ({ prompt, assistantResponse, assistantStatus }) => {
        const latest = conversationMessages.at(-1);
        if (
          assistantStatus !== "pending" &&
          latest?.role === "assistant" &&
          latest.status === "pending"
        ) {
          latest.content = assistantResponse;
          latest.status = assistantStatus;
        } else if (assistantStatus === "pending") {
          conversationMessages.push(
            { role: "user", content: prompt, status: "completed" },
            {
              role: "assistant",
              content: "AI response pending...",
              status: "pending",
            },
          );
        } else {
          conversationMessages.push(
            { role: "user", content: prompt, status: "completed" },
            { role: "assistant", content: assistantResponse, status: assistantStatus },
          );
        }
        return { data: {} };
      },
    );
    mockSearchRAG.mockResolvedValue([
      {
        text: "The document says the meeting starts at 10 AM.",
        metadata: { fileName: "meeting-notes.txt" },
        score: 0.92,
      },
    ]);
    listRagDocuments.mockResolvedValue([
      { _id: "document-1", title: "Meeting notes" },
    ]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("uses the unwrapped RAG result array and displays a valid grounded answer", async () => {
    const user = userEvent.setup();
    renderChat();
    await startConversation(user);

    await screen.findByRole("option", { name: "Meeting notes" });
    await user.selectOptions(
      screen.getByLabelText("Ask about:"),
      "document-1",
    );
    await submitPrompt(user, "When does the meeting start?");

    expect(
      await screen.findByText("Grounded answer from the document."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/meeting-notes\.txt/),
    ).toBeInTheDocument();
    expect(mockSearchRAG).toHaveBeenCalledWith(
      "When does the meeting start?",
      3,
      [0.25, 0.75],
      "document-1",
    );
    expect(generator).toHaveBeenCalledWith(
      [
        {
          role: "system",
          content: expect.stringContaining(
            "answer only with facts supported by those excerpts",
          ),
        },
        {
          role: "user",
          content: expect.stringContaining(
            "The document says the meeting starts at 10 AM.",
          ),
        },
      ],
      expect.any(Object),
    );
    expect(
      screen.queryByText("I don't see that in the document."),
    ).not.toBeInTheDocument();
  });

  test("keeps document questions grounded when search returns no chunks", async () => {
    const user = userEvent.setup();
    generatedAnswer =
      "I couldn't find that information in the provided documents.";
    mockSearchRAG.mockResolvedValue([]);
    renderChat();
    await startConversation(user);
    await screen.findByRole("option", { name: "Meeting notes" });
    await user.selectOptions(
      screen.getByLabelText("Ask about:"),
      "document-1",
    );
    await submitPrompt(user, "What color is the car in the document?");

    expect(
      await screen.findByText(
        "I couldn't find that information in the provided documents.",
      ),
    ).toBeInTheDocument();
    expect(generator.mock.calls[0][0][0]).toMatchObject({
      role: "system",
      content: expect.stringContaining(
        "if they do not support an answer, clearly say that the information was not found",
      ),
    });
    expect(screen.queryByText(/AI response failed:/)).not.toBeInTheDocument();
  });

  test("answers general questions without retrieved document chunks", async () => {
    const user = userEvent.setup();
    generatedAnswer = "A database index speeds up data lookups.";
    mockSearchRAG.mockResolvedValue([]);
    renderChat();
    await startConversation(user);
    await submitPrompt(user, "What is a database index?");

    expect(
      await screen.findByText("A database index speeds up data lookups."),
    ).toBeInTheDocument();
    const modelMessages = generator.mock.calls[0][0];
    expect(modelMessages[0]).toMatchObject({
      role: "system",
      content: expect.stringContaining(
        "answer helpfully using your general knowledge",
      ),
    });
    expect(modelMessages.at(-1).content).toContain(
      "No matching document excerpts were retrieved.",
    );
  });

  test("reports invalid RAG response shapes as errors instead of treating them as no evidence", async () => {
    const user = userEvent.setup();
    mockSearchRAG.mockResolvedValue({ data: [] });
    renderChat();
    await startConversation(user);
    await submitPrompt(user, "What does the document say?");

    expect(
      await screen.findByText(
        "AI response failed: Unable to generate an AI response. Please try again.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("I don't see that in the document."),
    ).not.toBeInTheDocument();
    expect(generator).not.toHaveBeenCalled();
  });

  test("reports search failures and always clears loading state", async () => {
    const user = userEvent.setup();
    mockSearchRAG.mockRejectedValue(new Error("Network unavailable"));
    renderChat();
    await startConversation(user);
    await submitPrompt(user, "Summarize this document.");

    expect(
      await screen.findByText(
        "AI response failed: Unable to generate an AI response. Please try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Network unavailable/)).not.toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Type your Questions here..."),
    ).toBeEnabled();
    expect(generator).not.toHaveBeenCalled();
  });

  test("uses recent conversation turns for retrieval and the follow-up prompt", async () => {
    const user = userEvent.setup();
    renderChat();
    await startConversation(user);
    await submitPrompt(user, "When does the meeting start?");
    await screen.findByText("Grounded answer from the document.");

    generatedAnswer = "It is in the main office.";
    await submitPrompt(user, "Where is the meeting?");
    await waitFor(() =>
      expect(generator).toHaveBeenCalledTimes(2),
    );

    expect(mockSearchRAG.mock.calls[1][0]).toContain(
      "When does the meeting start?",
    );
    expect(mockSearchRAG.mock.calls[1][0]).toContain(
      "Where is the meeting?",
    );
    const secondModelMessages = generator.mock.calls[1][0];
    expect(secondModelMessages).toHaveLength(4);
    expect(secondModelMessages[0]).toMatchObject({
      role: "system",
      content: expect.stringContaining(
        "Use the conversation history to understand follow-up questions",
      ),
    });
    expect(secondModelMessages[1]).toEqual({
      role: "user",
      content: "When does the meeting start?",
    });
    expect(secondModelMessages[2]).toEqual({
      role: "assistant",
      content: "Grounded answer from the document.",
    });
    expect(secondModelMessages[3].content).toContain(
      "QUESTION: Where is the meeting?",
    );
    expect(
      await screen.findByText("It is in the main office."),
    ).toBeInTheDocument();
  });

  test("treats unrecognized model objects as empty output, not visible JSON", async () => {
    const user = userEvent.setup();
    generator.mockResolvedValueOnce({ unexpected: "value" });
    renderChat();
    await startConversation(user);
    await submitPrompt(user, "Answer from the document.");

    expect(
      await screen.findByText(
        "AI response failed: Unable to generate an AI response. Please try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('{"unexpected":"value"}')).not.toBeInTheDocument();
  });

  test("shows a safe message when the local model provider fails", async () => {
    const user = userEvent.setup();
    generator.mockRejectedValueOnce(new Error("private provider details"));
    renderChat();
    await startConversation(user);
    await submitPrompt(user, "Summarize the document.");

    expect(
      await screen.findByText(
        "AI response failed: Unable to generate an AI response. Please try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/private provider details/)).not.toBeInTheDocument();
  });
});
