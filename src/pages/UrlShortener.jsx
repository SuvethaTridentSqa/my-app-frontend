import { useEffect, useState } from "react";
import BackButton from "../components/BackButton";
import UsageBadge from "../components/UsageBadge";
import { createUrl, getUrls } from "../api/url.js";

export default function UrlShortener() {
  const [longUrl, setLongUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [shortUrl, setShortUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
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

  const copyLink = async () => {
    if (!shortUrl) return;
    await navigator.clipboard.writeText(shortUrl);
    setMessage("Copied to clipboard!");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setShortUrl("");
    try {
      const payload = {
        originalUrl: longUrl.trim(),
      };
      if (alias.trim()) {
        payload.alias = alias.trim();
      }
      const response = await createUrl(payload);
      const generatedUrl =
        response.data.shortUrl ||
        `${window.location.origin}/u/${response.data.slug}`;
      setShortUrl(generatedUrl);
      setMessage("Short URL created successfully.");
      loadUrls();
      setLongUrl("");
      setAlias("");
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Unable to create short URL.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page-content-shortenURL">
      <BackButton />
      <header className="page-header-shortenURL">
        <div>
          <h2>Shorten URL</h2>
          <p>Convert long links into short, shareable URLs.</p>
        </div>
        <UsageBadge count={savedUrls.length} />
      </header>
      <div className="dashboard-toolbar-shortenURL">
        <form className="feature-form" onSubmit={handleSubmit}>
          <label>
            Long URL
            <input
              value={longUrl}
              onChange={(event) => setLongUrl(event.target.value)}
              type="url"
              placeholder="https://example.com/page"
              required
            />
          </label>
          <label>
            Custom alias (optional)
            <input
              value={alias}
              onChange={(event) => setAlias(event.target.value)}
              type="text"
              placeholder="nike2026"
            />
          </label>
          <div className="button-row">
            <button type="submit" disabled={busy}>
              {busy ? "Creating..." : "Create short link"}
            </button>
            {shortUrl && (
              <button
                type="button"
                className="secondary-button"
                onClick={copyLink}
              >
                Copy link
              </button>
            )}
          </div>
          {message && <div className="message-box">{message}</div>}
          {shortUrl && (
            <div className="link-preview">
              <span>{shortUrl}</span>
            </div>
          )}
        </form>
        <div className="admin-table">
          <div className="admin-row admin-header">
            <span>Slug</span>
            <span>Original URL</span>
            <span>Clicks</span>
          </div>
          {savedUrls.map((item) => (
            <div className="admin-row" key={item._id}>
              <span>{item.slug}</span>
              <span className="truncate">
                {"*".repeat(item.originalUrl.length / 2)}
              </span>
              <span>{item.clicks ?? 0}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
