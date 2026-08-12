export const normalizeSearchValue = (value) => {
  if (!value) return "";

  const trimmed = value.trim();
  const match = trimmed.match(/\/u\/([^/?#]+)/i);
  return match ? match[1] : trimmed;
};

const truncateUrl = (url = "") => {
  const length = Math.max(4, Math.floor(url.length / 2));
  return "*".repeat(length);
};

const hasItems = (value) => {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value && Object.keys(value).length > 0);
};

export function AnalyticsTableSection({ title, headers, rows, emptyText }) {
  return (
    <section className="analytics-table">
      <h3>{title}</h3>
      {hasItems(rows) ? (
        <table>
          <thead>
            <tr>
              {headers.map((heading) => (
                <th key={heading}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`cell-${rowIndex}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>{emptyText}</p>
      )}
    </section>
  );
}

export function SavedUrlsList({ savedUrls = [], onSelectUrl }) {
  return (
    <div className="admin-table">
      <div className="admin-row admin-header">
        <span>Slug</span>

        <span>URL</span>

        <span>Action</span>
      </div>

      {savedUrls.map((item) => (
        <div className="admin-row" key={item._id}>
          <span>{item.slug}</span>

          <span className="truncate">{truncateUrl(item.originalUrl)}</span>

          <button
            className="secondary-button"
            type="button"
            onClick={() => onSelectUrl(item)}
          >
            View
          </button>
        </div>
      ))}
    </div>
  );
}

export function MetricsSummary({ metrics = {}, savedCount }) {
  return (
    <div className="analytics-summary">
      <div className="metric-card">
        <h3>Total Clicks</h3>
        <p>{metrics.totalClicks ?? 0}</p>
      </div>

      {metrics.originalUrl && (
        <div className="metric-card">
          <h3>Original URL</h3>
          <p>{metrics.originalUrl}</p>
        </div>
      )}

      <div className="metric-card">
        <h3>Saved URLs</h3>
        <p>{savedCount}</p>
      </div>
    </div>
  );
}
