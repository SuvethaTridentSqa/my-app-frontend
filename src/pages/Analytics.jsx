import BackButton from "../components/BackButton";
import UsageBadge from "../components/UsageBadge";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getUrlAnalytics, getDashboardAnalytics } from "../api/analytics.js";
import { getUrls } from "../api/url.js";
import {
  normalizeSearchValue,
  AnalyticsTableSection,
  MetricsSummary,
  SavedUrlsList,
} from "../components/AnalyticsWidgets.jsx";

export default function Analytics() {
  const [query, setQuery] = useState("");
  const [metrics, setMetrics] = useState(null);
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

  const loadDefaultAnalytics = async () => {
    try {
      const response = await getDashboardAnalytics();
      setMetrics(response.data.analytics);
    } catch (error) {
      console.error("Failed to load dashboard analytics", error);
    }
  };

  useEffect(() => {
    loadUrls();
    loadDefaultAnalytics();
  }, []);

  const deviceRows = useMemo(
    () => Object.entries(metrics?.deviceBreakdown || {}),
    [metrics?.deviceBreakdown],
  );

  const geographyRows = useMemo(
    () =>
      Object.entries(metrics?.geography || {}).map(([location, count]) => [
        location.replace("unknown:unknown", "Unknown"),
        count,
      ]),
    [metrics?.geography],
  );

  const timeSeriesRows = useMemo(
    () =>
      Object.entries(metrics?.timeSeries || {}).sort(([a], [b]) =>
        a.localeCompare(b),
      ),
    [metrics?.timeSeries],
  );

  const clickHistoryRows = useMemo(
    () =>
      metrics?.events?.map((event) => [
        new Date(event.clickedAt).toLocaleString(),
        event.device,
        event.browser,
        event.country,
        event.city,
        event.referer,
      ]) ?? [],
    [metrics?.events],
  );

  const handleSearch = useCallback(
    async (event) => {
      event.preventDefault();

      const searchValue = normalizeSearchValue(query);
      if (!searchValue) {
        setMessage("Please enter a short URL, alias, or original URL.");
        return;
      }

      setBusy(true);
      setMessage("");
      setMetrics(null);

      try {
        const response = await getUrlAnalytics(searchValue);
        const analytics = response.data.analytics || response.data;

        setMetrics({
          ...analytics,
          originalUrl: response.data.url?.originalUrl,
          slug: response.data.url?.slug,
          events: response.data.events || analytics.events || [],
        });
      } catch (error) {
        setMetrics(null);
        setMessage(
          error.response?.data?.message ||
            "Unable to load analytics. Please try again.",
        );
      } finally {
        setBusy(false);
      }
    },
    [query],
  );

  const handleSelectUrl = useCallback((item) => {
    setQuery(item.slug);
    setMessage("");
  }, []);

  return (
    <section className="page-content">
      <BackButton />

      <header className="page-header">
        <div>
          <h2>Analytics</h2>
          <p>Track clicks, devices, and traffic patterns.</p>
        </div>

        <UsageBadge count={8} />
      </header>

      <form className="analytics-search" onSubmit={handleSearch}>
        <label>
          Enter short URL, alias or original URL
          <div className="search-field">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="fb2026, http://localhost:5000/u/fb2026 or https://www.facebook.com"
            />

            <button type="submit" disabled={busy}>
              {busy ? "Loading..." : "Fetch Analytics"}
            </button>
          </div>
        </label>
      </form>

      {message && <div className="message-box warn">{message}</div>}

      <div className="analytics-layout">
        <SavedUrlsList savedUrls={savedUrls} onSelectUrl={handleSelectUrl} />

        <div className="analytics-result">
          {metrics ? (
            <>
              <MetricsSummary metrics={metrics} savedCount={savedUrls.length} />

              <AnalyticsTableSection
                title="Device Breakdown"
                headers={["Device", "Clicks"]}
                rows={deviceRows}
                emptyText="No device data available."
              />

              <AnalyticsTableSection
                title="Geography Breakdown"
                headers={["Location", "Clicks"]}
                rows={geographyRows}
                emptyText="No geography data available."
              />

              <AnalyticsTableSection
                title="Time Series"
                headers={["Hour", "Clicks"]}
                rows={timeSeriesRows}
                emptyText="No time series data available."
              />

              <AnalyticsTableSection
                title="Click History"
                headers={[
                  "Time",
                  "Device",
                  "Browser",
                  "Country",
                  "City",
                  "Referer",
                ]}
                rows={clickHistoryRows}
                emptyText="No clicks recorded yet."
              />
            </>
          ) : (
            !message && (
              <div className="analytics-empty">
                <p>
                  Search for a link to load analytics summary and geographic
                  trends.
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}
