import { useEffect, useState } from "react";
import BackButton from "../components/BackButton";
import UsageBadge from "../components/UsageBadge";
import { createUrl, getUrls } from "../api/url.js";

export default function CustomAlias() {
  const [alias, setAlias] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [status, setStatus] = useState("");
  const [shortUrl, setShortUrl] = useState("");
  const [savedUrls, setSavedUrls] = useState([]);

  const loadUrls = async () => {
    try {
      const response = await getUrls();
      setSavedUrls(response.data);
    } catch (error) {
      console.error("Failed to load urls", error);
    }
  };

  useEffect(() => {
    loadUrls();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setStatus("");
    setShortUrl("");

    try {
      const payload = {
        originalUrl: targetUrl.trim(),
        alias: alias.trim(),
      };

      const response = await createUrl(payload);

      setShortUrl(
        response.data.shortUrl ||
          `${window.location.origin}/u/${response.data.slug}`,
      );

      setStatus("Custom alias created successfully.");

      // refresh stored urls
      loadUrls();

      setAlias("");
      setTargetUrl("");
    } catch (error) {
      setStatus(error.response?.data?.message || "Failed to save alias.");
    }
  };

  return (
    <section className="page-content">
      <BackButton />

      <header className="page-header">
        <div>
          <h2>Custom Alias</h2>
          <p>Create unique short links with your own alias.</p>
        </div>

        <UsageBadge count={savedUrls.length} />
      </header>

      <div className="dashboard-toolbar">
        <form className="feature-form" onSubmit={handleSubmit}>
          <label>
            Desired alias
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              type="text"
              placeholder="nike2026"
              required
            />
          </label>

          <label>
            Original URL
            <input
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              type="url"
              placeholder="https://example.com/product"
              required
            />
          </label>

          {status && <div className="message-box">{status}</div>}

          <button type="submit">Save alias</button>

          {shortUrl && (
            <div className="link-preview">
              <span>{shortUrl}</span>

              <button
                type="button"
                className="secondary-button"
                onClick={() => navigator.clipboard.writeText(shortUrl)}
              >
                Copy
              </button>
            </div>
          )}
        </form>

        <div className="admin-table">
          <div className="admin-row admin-header">
            <span>Alias</span>

            <span>Original URL</span>

            <span>Created</span>
          </div>

          {savedUrls.map((item) => (
            <div key={item._id} className="admin-row">
              <span>{item.slug}</span>

              {/* <span className="truncate">{item.originalUrl}</span> */}
              <span className="truncate">
                {"*".repeat(item.originalUrl.length / 2)}
              </span>

              <span>{new Date(item.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
