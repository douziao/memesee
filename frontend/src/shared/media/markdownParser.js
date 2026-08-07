function isBlankLine(line) {
  return !String(line || "").trim();
}

function isFenceStart(line) {
  return /^```/.test(line);
}

function isHeadingLine(line) {
  return /^(#{1,6})\s+(.+)$/.test(line);
}

function isHorizontalRuleLine(line) {
  return /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line);
}

function isBlockquoteLine(line) {
  return /^>\s?/.test(line);
}

function parseListLine(line) {
  const match = String(line || "").match(/^(\s*)((?:[-*+])|(?:\d+[.)]))\s+(?:\[( |x|X)]\s+)?(.+)$/);
  if (!match) {
    return null;
  }
  return {
    indent: match[1].replace(/\t/g, "    ").length,
    ordered: /\d/.test(match[2]),
    checked: match[3] == null ? null : match[3].toLowerCase() === "x",
    text: match[4],
  };
}

function parseListBlock(lines, startIndex, baseIndent) {
  const firstItem = parseListLine(lines[startIndex]);
  const ordered = Boolean(firstItem?.ordered);
  const items = [];
  let index = startIndex;

  while (index < lines.length) {
    const item = parseListLine(lines[index]);
    if (!item || item.indent < baseIndent) {
      break;
    }
    if (item.indent > baseIndent) {
      if (items.length === 0) {
        break;
      }
      const nestedList = parseListBlock(lines, index, item.indent);
      if (nestedList.items.length === 0) {
        break;
      }
      items[items.length - 1].children.push(nestedList.block);
      index = nestedList.nextIndex;
      continue;
    }
    if (item.ordered !== ordered) {
      break;
    }
    items.push({
      text: item.text,
      checked: item.checked,
      children: [],
    });
    index += 1;
  }

  return {
    block: { type: "list", ordered, items },
    items,
    nextIndex: index,
  };
}

function splitTableRow(line) {
  const trimmed = String(line || "").trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let currentCell = "";
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char === "\\" && trimmed[index + 1] === "|") {
      currentCell += "|";
      index += 1;
      continue;
    }
    if (char === "|") {
      cells.push(currentCell.trim());
      currentCell = "";
      continue;
    }
    currentCell += char;
  }
  cells.push(currentCell.trim());
  return cells;
}

function normalizeTableCells(cells, columnCount) {
  if (columnCount <= 0) {
    return cells;
  }
  if (cells.length > columnCount) {
    return [
      ...cells.slice(0, columnCount - 1),
      cells.slice(columnCount - 1).join(" | "),
    ];
  }
  if (cells.length < columnCount) {
    return [
      ...cells,
      ...Array.from({ length: columnCount - cells.length }, () => ""),
    ];
  }
  return cells;
}

function isTableSeparatorLine(line) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isTableStart(lines, index) {
  return String(lines[index] || "").includes("|") && isTableSeparatorLine(lines[index + 1] || "");
}

function isSpecialBlockStart(lines, index) {
  const line = lines[index] || "";
  return isFenceStart(line) ||
    isHeadingLine(line) ||
    isHorizontalRuleLine(line) ||
    isBlockquoteLine(line) ||
    parseListLine(line) ||
    isTableStart(lines, index);
}

function splitTrailingAutolinkPunctuation(value) {
  const match = String(value || "").match(/^(.+?)([.,!?;:，。、！？；：)]*)$/);
  return {
    href: match?.[1] || String(value || ""),
    trailingText: match?.[2] || "",
  };
}

export function parseMarkdownInlineSegments(text) {
  const source = String(text || "");
  const pattern = /(!?)\[([^\]]*)]\(([^)\s]+)(?:\s+"[^"]*")?\)|`([^`]+)`|~~([^~]+)~~|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|\b((?:https?:\/\/|www\.)[^\s<，。、！？；：]+)|\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi;
  const segments = [];
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", text: source.slice(lastIndex, match.index) });
    }
    if (match[3]) {
      segments.push({
        type: match[1] ? "image" : "link",
        text: match[2],
        href: match[3],
      });
    } else if (match[4]) {
      segments.push({ type: "code", text: match[4] });
    } else if (match[5]) {
      segments.push({ type: "delete", text: match[5] });
    } else if (match[6] || match[7]) {
      segments.push({ type: "strong", text: match[6] || match[7] });
    } else if (match[8] || match[9]) {
      segments.push({ type: "em", text: match[8] || match[9] });
    } else if (match[10]) {
      const { href, trailingText } = splitTrailingAutolinkPunctuation(match[10]);
      segments.push({
        type: "autoLink",
        text: href,
        href: href.startsWith("www.") ? `https://${href}` : href,
      });
      if (trailingText) {
        segments.push({ type: "text", text: trailingText });
      }
    } else if (match[11]) {
      segments.push({
        type: "autoLink",
        text: match[11],
        href: `mailto:${match[11]}`,
      });
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < source.length) {
    segments.push({ type: "text", text: source.slice(lastIndex) });
  }
  return segments.length ? segments : [{ type: "text", text: source }];
}

export function parseMarkdownBlocks(content) {
  const lines = String(content || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (isBlankLine(line)) {
      index += 1;
      continue;
    }

    if (isFenceStart(line)) {
      const language = line.replace(/^```/, "").trim();
      const codeLines = [];
      index += 1;
      while (index < lines.length && !isFenceStart(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({ type: "code", language, text: codeLines.join("\n") });
      continue;
    }

    if (isTableStart(lines, index)) {
      const header = splitTableRow(lines[index]);
      const align = normalizeTableCells(splitTableRow(lines[index + 1]), header.length).map((cell) => {
        if (cell.startsWith(":") && cell.endsWith(":")) return "center";
        if (cell.endsWith(":")) return "right";
        return "";
      });
      const rows = [];
      index += 2;
      while (index < lines.length && String(lines[index] || "").includes("|") && !isBlankLine(lines[index])) {
        rows.push(normalizeTableCells(splitTableRow(lines[index]), header.length));
        index += 1;
      }
      blocks.push({ type: "table", header, align, rows });
      continue;
    }

    const headingMatch = String(line || "").match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        lines: [headingMatch[2].trim()],
      });
      index += 1;
      continue;
    }

    if (isHorizontalRuleLine(line)) {
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }

    if (isBlockquoteLine(line)) {
      const quoteLines = [];
      while (index < lines.length && isBlockquoteLine(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "blockquote", lines: quoteLines });
      continue;
    }

    const listLine = parseListLine(line);
    if (listLine) {
      const listBlock = parseListBlock(lines, index, listLine.indent);
      blocks.push(listBlock.block);
      index = listBlock.nextIndex;
      continue;
    }

    const paragraphLines = [];
    while (index < lines.length && !isBlankLine(lines[index]) && !isSpecialBlockStart(lines, index)) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    if (paragraphLines.length > 0) {
      blocks.push({ type: "paragraph", lines: paragraphLines });
    } else {
      index += 1;
    }
  }

  return blocks;
}
