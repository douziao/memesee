export function PageShell({ children, className = "", as: Tag = "section" }) {
  return (
    <Tag className={["page-shell", className].filter(Boolean).join(" ")}>
      {children}
    </Tag>
  );
}

export function StatusCard({
  kicker,
  title,
  description,
  children,
  className = "",
  tone = "default",
  role,
  ariaLive,
}) {
  const toneClass = tone === "loading"
    ? "is-loading"
    : (tone === "empty" ? "feed-status-card-empty" : "");
  return (
    <article
      className={["feed-status-card", toneClass, className].filter(Boolean).join(" ")}
      role={role}
      aria-live={ariaLive}
    >
      {kicker ? <span className="feed-status-kicker">{kicker}</span> : null}
      {title ? <strong>{title}</strong> : null}
      {description ? <span className="feed-status-subtext">{description}</span> : null}
      {children}
    </article>
  );
}
