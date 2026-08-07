import { PageShell } from "../../../../shared/components/PageShell";

export default function PostDetailLayout({ children }) {
  return (
    <PageShell className="feed-grid">
      {children}
    </PageShell>
  );
}
