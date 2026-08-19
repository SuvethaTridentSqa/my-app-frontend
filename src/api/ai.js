import api from "./api";

export const getChatConversations = async () => {
  return await api.get("/ai/conversations");
};

export const getConversation = async (conversationId) => {
  return await api.get(`/ai/conversations/${conversationId}`);
};

export const createChatConversation = async (title) => {
  return await api.post("/ai/conversations", { title });
};

export const sendChatMessage = ({
  prompt,
  conversationId,
  assistantResponse,
  assistantStatus = "completed",
}) =>
  api.post("/ai/chat", {
    prompt,
    conversationId,
    assistantResponse,
    assistantStatus,
  });
