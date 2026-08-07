import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MarkdownRenderer from "./MarkdownRenderer";

function renderMarkdown(props = {}) {
  return renderToStaticMarkup(
    <div className="markdown-content">
      <MarkdownRenderer
        content=""
        mediaAssets={[]}
        openImageViewer={() => {}}
        {...props}
      />
    </div>,
  );
}

describe("MarkdownRenderer", () => {
  it("renders a realistic long-form markdown article with tables and tasks", () => {
    const markup = renderMarkdown({
      content: [
        "# 复盘",
        "",
        "第一段包含 **重点**、~~旧结论~~、[站内链接](posts/42)、https://memesee.world/posts/7 和 `inline code`。",
        "",
        "> 引用一行",
        "",
        "- [x] 已完成",
        "  - 子任务",
        "- [ ] 待确认",
        "",
        "| 指标 | 结果 |",
        "| :--- | ---: |",
        "| gzip | 150KB |",
        "| A \\| B | 保留管道 |",
      ].join("\n"),
    });

    expect(markup).toContain("<h1>复盘</h1>");
    expect(markup).toContain("<strong>重点</strong>");
    expect(markup).toContain("<del>旧结论</del>");
    expect(markup).toContain('<a href="/posts/42" target="_blank" rel="noreferrer">站内链接</a>');
    expect(markup).toContain('<a href="https://memesee.world/posts/7" target="_blank" rel="noreferrer">https://memesee.world/posts/7</a>');
    expect(markup).toContain("<code>inline code</code>");
    expect(markup).toContain("<blockquote><p>引用一行</p></blockquote>");
    expect(markup).toContain('class="contains-task-list"');
    expect(markup).toContain("<li>子任务</li>");
    expect(markup).toContain('type="checkbox"');
    expect(markup).toContain('checked=""');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('readonly=""');
    expect(markup).toContain('class="markdown-table-scroll"');
    expect(markup).toContain('role="region"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('aria-label="Markdown 表格"');
    expect(markup).toContain("<table>");
    expect(markup).toContain("<th>指标</th>");
    expect(markup).toContain('<th style="text-align:right">结果</th>');
    expect(markup).toContain("<td>A | B</td>");
  });

  it("keeps non-pipe backslashes in rendered table cells", () => {
    const markup = renderMarkdown({
      content: [
        "| 路径 | 说明 |",
        "| --- | --- |",
        "| C:\\Users\\nya | Windows 路径 |",
        "| /posts/\\d+ | 正则片段 |",
      ].join("\n"),
    });

    expect(markup).toContain("<td>C:\\Users\\nya</td>");
    expect(markup).toContain("<td>/posts/\\d+</td>");
  });

  it("keeps extra table cell text visible in the last rendered column", () => {
    const markup = renderMarkdown({
      content: [
        "| 名称 | 备注 |",
        "| --- | --- |",
        "| A | 多写 | 第三段 |",
        "| B |",
      ].join("\n"),
    });

    expect(markup).toContain("<td>多写 | 第三段</td>");
    expect(markup).toContain("<td></td>");
  });

  it("escapes raw HTML and degrades unsupported link protocols", () => {
    const markup = renderMarkdown({
      content: [
        "正文 <script>alert(1)</script>",
        "",
        "[危险](javascript:alert(1)) [安全](https://memesee.world/posts/42)",
        "",
        "![外链图](https://evil.example/image.jpg)",
      ].join("\n"),
    });

    expect(markup).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(markup).not.toContain("javascript:alert");
    expect(markup).toContain("<span>危险</span>");
    expect(markup).toContain('href="https://memesee.world/posts/42"');
    expect(markup).not.toContain("evil.example/image.jpg");
  });

  it("turns pasted www links and email addresses into safe links", () => {
    const markup = renderMarkdown({
      content: "入口 www.memesee.world，联系 hello@memesee.world。",
    });

    expect(markup).toContain('href="https://www.memesee.world"');
    expect(markup).toContain('>www.memesee.world</a>，');
    expect(markup).toContain('href="mailto:hello@memesee.world"');
  });

  it("renders media references through MarkdownMediaImage and strips unavailable media", () => {
    const markup = renderMarkdown({
      content: "![图一|320](media:asset-1?width=320)\n\n![缺失](media:missing)",
      mediaAssets: [{
        id: 1,
        publicId: "asset-1",
        mediumUrl: "/media/asset-1-medium.webp",
        displayUrl: "/media/asset-1-display.webp",
        originalUrl: "/media/asset-1-original.webp",
        width: 1200,
        height: 600,
      }],
    });

    expect(markup).toContain('class="markdown-image-frame is-custom-size has-custom-width');
    expect(markup).toContain('src="/media/asset-1-medium.webp"');
    expect(markup).toContain('alt="图一"');
    expect(markup).toContain("图片已不在当前草稿中");
  });

  it("uses the supplied code block renderer for copy-capable detail code blocks", () => {
    const markup = renderMarkdown({
      content: "```js\nconst answer = 42;\n```",
      renderPre: ({ children }) => (
        <pre className="markdown-code-block">
          <code>{children}</code>
        </pre>
      ),
    });

    expect(markup).toContain('class="markdown-code-block"');
    expect(markup).toContain("const answer = 42;");
  });
});
