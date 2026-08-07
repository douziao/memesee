import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DetailMarkdownRenderer from "./DetailMarkdownRenderer";

describe("DetailMarkdownRenderer", () => {
  it("renders copy-capable code blocks without runtime hook failures", () => {
    const markup = renderToStaticMarkup(
      <div className="markdown-content article-content">
        <DetailMarkdownRenderer
          apiBase=""
          openImageViewer={() => {}}
          selectedPost={{
            id: 42,
            postMode: "long",
            content: "```js\nconst answer = 42;\n```",
            mediaAssets: [],
          }}
        />
      </div>,
    );

    expect(markup).toContain('class="markdown-code-block"');
    expect(markup).toContain('class="markdown-code-copy "');
    expect(markup).toContain('aria-label="复制代码"');
    expect(markup).toContain("const answer = 42;");
  });
});
