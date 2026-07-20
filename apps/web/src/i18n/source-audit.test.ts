import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const PRODUCT_ROOTS = ["routes", "components"];
const EXCLUDED_PRODUCT_PATHS = [
  /(^|\/)editorial(\/|$)/,
  /(^|\/)editorial-showcase\.tsx$/,
  /(^|\/)ui-kit-page\.tsx$/,
];

function discoverProductFiles(): string[] {
  const srcRoot = path.resolve(import.meta.dirname, "..");
  const files: string[] = [];

  function walk(relativeDirectory: string) {
    const absoluteDirectory = path.join(srcRoot, relativeDirectory);
    for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
      const relative = path.posix.join(relativeDirectory.replaceAll("\\", "/"), entry.name);
      if (entry.isDirectory()) {
        walk(relative);
      } else if (
        entry.name.endsWith(".tsx")
        && !entry.name.includes(".test.")
        && !EXCLUDED_PRODUCT_PATHS.some((pattern) => pattern.test(relative))
      ) {
        files.push(relative);
      }
    }
  }

  PRODUCT_ROOTS.forEach(walk);
  return files.sort();
}

const PORTUGUESE_COPY = /[áéíóúâêôãõç]|\b(?:agora|amanhã|cancelar|concluído|erro|excluir|fechar|hoje|não|nenhum|nenhuma|salvar|seu|sua|tarefa|você)\b/i;
const UI_MESSAGE_CALLS = new Set(["alert", "confirm", "showError", "showSuccess"]);
const LOCALIZATION_CALLS = new Set(["l", "t", "selectLocalizedCopy"]);

function lineOf(source: ts.SourceFile, node: ts.Node) {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function visiblePortuguese(file: string): string[] {
  const absolute = path.resolve(import.meta.dirname, "..", file);
  const source = ts.createSourceFile(
    absolute,
    fs.readFileSync(absolute, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const failures: string[] = [];

  function record(node: ts.Node, text: string) {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (normalized && PORTUGUESE_COPY.test(normalized)) {
      failures.push(`${file}:${lineOf(source, node)} ${normalized.slice(0, 120)}`);
    }
  }

  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) {
      record(node, node.getText(source));
    } else if (
      ts.isJsxAttribute(node)
      && node.initializer
      && ts.isStringLiteral(node.initializer)
      && ["aria-label", "placeholder", "title"].includes(node.name.getText(source))
    ) {
      record(node, node.initializer.text);
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && UI_MESSAGE_CALLS.has(node.expression.text)) {
      const first = node.arguments[0];
      if (first && (ts.isStringLiteralLike(first) || ts.isNoSubstitutionTemplateLiteral(first))) {
        record(first, first.text);
      }
    } else if (ts.isStringLiteralLike(node)) {
      if (ts.isBinaryExpression(node.parent)) {
        ts.forEachChild(node, visit);
        return;
      }
      if (
        ts.isPropertyAssignment(node.parent)
        && (ts.isIdentifier(node.parent.name) || ts.isStringLiteral(node.parent.name))
        && ["id", "key", "value"].includes(node.parent.name.text)
      ) return;
      let parent: ts.Node | undefined = node.parent;
      let insideJsxExpression = false;
      let localized = false;
      while (parent && !ts.isStatement(parent) && !ts.isSourceFile(parent)) {
        if (ts.isJsxExpression(parent)) insideJsxExpression = true;
        if (
          ts.isCallExpression(parent)
          && ts.isIdentifier(parent.expression)
          && LOCALIZATION_CALLS.has(parent.expression.text)
        ) localized = true;
        parent = parent.parent;
      }
      if (insideJsxExpression && !localized) record(node, node.text);
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return failures;
}

describe("English product surface audit", () => {
  it("does not leave Portuguese directly embedded in visible consumer UI", () => {
    expect(discoverProductFiles().flatMap(visiblePortuguese)).toEqual([]);
  }, 20_000);
});
