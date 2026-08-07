import { Suspense, lazy } from "react";

const DetailMarkdownRenderer = lazy(() => import("./DetailMarkdownRenderer"));

export default function DetailContent({ markdownInput }) {
  return (
    <div className="post-detail-content markdown-content article-content">
      {markdownInput?.selectedPost && (
        <Suspense fallback={null}>
          <DetailMarkdownRenderer {...markdownInput} />
        </Suspense>
      )}
    </div>
  );
}
