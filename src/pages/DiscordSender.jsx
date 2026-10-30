import { useState } from "react";
import api from "../api/api.js";

export default function DiscordSender() {
  const [text, setText] = useState("");

  const sendToDiscord = async () => {
    try {
      const response = await api.post("/send-message", {
        message: text,
        channelId: "YOUR_TARGET_DISCORD_CHANNEL_ID",
      });

      if (response.success) alert("Message sent to Discord successfully!");
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  return (
    <div>
      <h3>Send Message to Discord from React</h3>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message..."
      />
      <button onClick={sendToDiscord}>Send</button>
    </div>
  );
}
