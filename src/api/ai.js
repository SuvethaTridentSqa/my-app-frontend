import api from "./api";
export const getChatConversations = () => api.get("/ai/conversations");
export const getConversation = (id) => api.get(`/ai/conversations/${id}`);
export const createChatConversation = (title) =>
  api.post("/ai/conversations", { title });
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
