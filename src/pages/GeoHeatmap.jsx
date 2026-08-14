import { useEffect, useMemo, useState } from "react";
import BackButton from "../components/BackButton";
import UsageBadge from "../components/UsageBadge";
import { getUrls } from "../api/url.js";
import { getGeoAnalytics } from "../api/analytics.js";
import LinkVisualizer from "./LinkVisualizer";

export default function GeoHeatmap() {
  const [urls, setUrls] = useState([]);
  const [selectedUrl, setSelectedUrl] = useState("");
  const [geoData, setGeoData] = useState({});
  const [loading, setLoading] = useState(false);
  const [sourceType, setSourceType] = useState("");
  useEffect(() => {
    const loadUrls = async () => {
      try {
        const response = await getUrls();
        setUrls(response.data);
      } catch (error) {
        console.error("Failed to load URLs", error);
      }
    };
    loadUrls();
  }, []);

  const loadGeo = async (slug) => {
    try {
      setLoading(true);
      const response = await getGeoAnalytics(slug);
      const geography =
        response.data.analytics?.geography || response.data.geography || {};
      setGeoData(geography);
    } catch (error) {
      console.error("Geo analytics failed", error);
      setGeoData({});
    } finally {
      setLoading(false);
    }
  };

  const handleUrlChange = (event) => {
    const slug = event.target.value;
    setSelectedUrl(slug);
    if (slug) {
      loadGeo(slug);
    } else {
      setGeoData({});
    }
  };

  const locations = useMemo(() => {
    return Object.entries(geoData);
  }, [geoData]);

  return (
    <section className="page-content">
      <BackButton />
      <header className="page-header">
        <div>
          <h2>URL Visual Analytics</h2>
          <p>Analyze visitor geography or visualize link structures.</p>
        </div>
        <UsageBadge count={urls.length} />
      </header>

      {/* Select visualization mode */}

      <div className="feature-form_2">
        <label>
          Fetch Data From &nbsp; &nbsp;
          <select
            value={sourceType}
            onChange={(e) => {
              setSourceType(e.target.value);
              setGeoData({});
              setSelectedUrl("");
            }}
          >
            <option value="">Choose Source</option>
            <option value="existing">Existing URL</option>
            <option value="new">New URL</option>
          </select>
        </label>
      </div>

      {/* Existing URL */}

      {sourceType === "existing" && (
        <>
          <div className="feature-form_2">
            <label>
              Select URL
              <select value={selectedUrl} onChange={handleUrlChange}>
                <option value="">Choose URL</option>
                {urls.map((url) => (
                  <option key={url._id} value={url.slug}>
                    {url.slug}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {loading && (
            <div className="message-box">Loading location data...</div>
          )}
          <div className="analytics-summary">
            {selectedUrl ? (
              locations.length > 0 ? (
                locations.map(([location, count]) => (
                  <div className="metric-card" key={location}>
                    <h3>{location}</h3>
                    <p>Clicks: {count}</p>
                  </div>
                ))
              ) : (
                <div className="analytics-empty">
                  <p>No geographic clicks available.</p>
                </div>
              )
            ) : (
              <div className="analytics-empty">
                <p>Choose an existing URL to load geographic clicks.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* New URL */}

      {sourceType === "new" && (
        <div className="visualizer-container">
          <LinkVisualizer />
        </div>
      )}
    </section>
  );
}
