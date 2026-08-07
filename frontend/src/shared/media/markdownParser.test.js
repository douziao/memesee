import { describe, expect, it } from "vitest";
import {
  parseMarkdownBlocks,
  parseMarkdownInlineSegments,
} from "./markdownParser";

describe("markdown parser", () => {
  it("parses common block types without executing markup", () => {
    expect(parseMarkdownBlocks([
      "# 标题",
      "",
      "> 引用",
      "",
      "- [x] 已完成",
      "- [ ] 待处理",
      "",
      "```js",
      "const a = '<script>';",
      "```",
    ].join("\n"))).toEqual([
      { type: "heading", level: 1, lines: ["标题"] },
      { type: "blockquote", lines: ["引用"] },
      {
        type: "list",
        ordered: false,
        items: [
          { text: "已完成", checked: true, children: [] },
          { text: "待处理", checked: false, children: [] },
        ],
      },
      { type: "code", language: "js", text: "const a = '<script>';" },
    ]);
  });

  it("parses table headers, alignment and rows", () => {
    expect(parseMarkdownBlocks([
      "| 名称 | 热度 |",
      "| :--- | ---: |",
      "| A | 12 |",
    ].join("\n"))).toEqual([{
      type: "table",
      header: ["名称", "热度"],
      align: ["", "right"],
      rows: [["A", "12"]],
    }]);
  });

  it("keeps escaped pipes inside table cells", () => {
    expect(parseMarkdownBlocks([
      "| 表达式 | 说明 |",
      "| --- | --- |",
      "| A \\| B | 不拆列 |",
    ].join("\n"))).toEqual([{
      type: "table",
      header: ["表达式", "说明"],
      align: ["", ""],
      rows: [["A | B", "不拆列"]],
    }]);
  });

  it("keeps non-pipe backslashes inside table cells", () => {
    expect(parseMarkdownBlocks([
      "| 路径 | 说明 |",
      "| --- | --- |",
      "| C:\\Users\\nya | Windows 路径 |",
      "| /posts/\\d+ | 正则片段 |",
    ].join("\n"))).toEqual([{
      type: "table",
      header: ["路径", "说明"],
      align: ["", ""],
      rows: [
        ["C:\\Users\\nya", "Windows 路径"],
        ["/posts/\\d+", "正则片段"],
      ],
    }]);
  });

  it("normalizes uneven table rows without dropping content", () => {
    expect(parseMarkdownBlocks([
      "| 名称 | 备注 |",
      "| --- | :---: | ---: |",
      "| A | 多写 | 第三段 |",
      "| B |",
    ].join("\n"))).toEqual([{
      type: "table",
      header: ["名称", "备注"],
      align: ["", "center"],
      rows: [
        ["A", "多写 | 第三段"],
        ["B", ""],
      ],
    }]);
  });

  it("keeps nested lists attached to their parent item", () => {
    expect(parseMarkdownBlocks([
      "- 父级",
      "  - 子级",
      "    1. 子步骤",
      "- 同级",
    ].join("\n"))).toEqual([{
      type: "list",
      ordered: false,
      items: [
        {
          text: "父级",
          checked: null,
          children: [{
            type: "list",
            ordered: false,
            items: [{
              text: "子级",
              checked: null,
              children: [{
                type: "list",
                ordered: true,
                items: [{
                  text: "子步骤",
                  checked: null,
                  children: [],
                }],
              }],
            }],
          }],
        },
        {
          text: "同级",
          checked: null,
          children: [],
        },
      ],
    }]);
  });

  it("parses inline links, media images and emphasis", () => {
    expect(parseMarkdownInlineSegments("**强** ~~旧~~ [帖](posts/1) ![图](media:asset-1) `code`")).toEqual([
      { type: "strong", text: "强" },
      { type: "text", text: " " },
      { type: "delete", text: "旧" },
      { type: "text", text: " " },
      { type: "link", text: "帖", href: "posts/1" },
      { type: "text", text: " " },
      { type: "image", text: "图", href: "media:asset-1" },
      { type: "text", text: " " },
      { type: "code", text: "code" },
    ]);
  });

  it("parses pasted URLs and email addresses as auto links", () => {
    expect(parseMarkdownInlineSegments("看 https://memesee.world/posts/42, 联系 hello@memesee.world 或 www.memesee.world。"))
      .toEqual([
        { type: "text", text: "看 " },
        {
          type: "autoLink",
          text: "https://memesee.world/posts/42",
          href: "https://memesee.world/posts/42",
        },
        { type: "text", text: "," },
        { type: "text", text: " 联系 " },
        {
          type: "autoLink",
          text: "hello@memesee.world",
          href: "mailto:hello@memesee.world",
        },
        { type: "text", text: " 或 " },
        {
          type: "autoLink",
          text: "www.memesee.world",
          href: "https://www.memesee.world",
        },
        { type: "text", text: "。" },
      ]);
  });
});
