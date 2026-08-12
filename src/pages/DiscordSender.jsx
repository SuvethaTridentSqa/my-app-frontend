import React, { useState } from "react";

export default function DiscordSender() {
  const [text, setText] = useState("");

  const sendToDiscord = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          channelId: "YOUR_TARGET_DISCORD_CHANNEL_ID",
        }),
      });

      const data = await response.json();
      if (data.success) alert("Message sent to Discord successfully!");
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
