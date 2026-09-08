import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const roots = ["app/(app)", "app/(auth)", "app/portal", "components"];
const attributeNames = new Set(["aria-label", "placeholder", "title", "label", "note", "description", "created", "error"]);
const propertyNames = new Set(["label", "note", "title", "description"]);
const results = new Map();
const buttons = new Set();

function add(file, value) {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || !/[A-Za-z]/.test(text) || text.startsWith("/") || text.includes("className")) return;
  if (!results.has(file)) results.set(file, new Set());
  results.get(file).add(text);
}

function literalsInside(node, file) {
  // This component uses typed keys from lib/i18n/inspection.ts. Its bilingual
  // dictionary is checked by inspection-workflow.spec.ts, not as raw captions.
  if (["components/inspection-workflow.tsx", "components/followup-list.tsx"].includes(file) && ts.isCallExpression(node) && node.expression.getText() === "t") return;
  if (ts.isStringLiteralLike(node)) add(file, node.text);
  ts.forEachChild(node, (child) => literalsInside(child, file));
}

function collectControlText(children) {
  for (const child of children) {
    if (ts.isJsxText(child)) {
      const text = child.text.replace(/\s+/g, " ").trim();
      if (text && /[A-Za-z]/.test(text)) buttons.add(text);
    }
    if (ts.isJsxExpression(child) && child.expression && ts.isStringLiteralLike(child.expression)) buttons.add(child.expression.text);
  }
}

function walk(node, file) {
  if (ts.isJsxElement(node)) {
    const tag = node.openingElement.tagName.getText();
    const classAttribute = node.openingElement.attributes.properties.find((property) => ts.isJsxAttribute(property) && property.name.getText() === "className");
    const classValue = classAttribute && ts.isJsxAttribute(classAttribute) && classAttribute.initializer && ts.isStringLiteral(classAttribute.initializer) ? classAttribute.initializer.text : "";
    if (tag === "button" || (tag === "Link" && /button|panel-link/.test(classValue))) collectControlText(node.children);
  }
  if (ts.isJsxText(node)) add(file, node.text);
  if (ts.isJsxAttribute(node) && attributeNames.has(node.name.getText())) {
    if (file === "components/inspection-workflow.tsx" && node.name.getText() === "label" && node.parent.parent.tagName?.getText() === "Field") return;
    if (node.initializer && ts.isStringLiteral(node.initializer)) add(file, node.initializer.text);
    if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) literalsInside(node.initializer.expression, file);
  }
  if (ts.isPropertyAssignment(node) && propertyNames.has(node.name.getText())) literalsInside(node.initializer, file);
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "routeMessage") {
    const message = node.arguments.at(-1);
    if (message) literalsInside(message, file);
  }
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "run") {
    node.arguments.slice(-2).forEach((argument) => literalsInside(argument, file));
  }
  ts.forEachChild(node, (child) => walk(child, file));
}

for (const root of roots) {
  for (const file of fs.readdirSync(root, { recursive: true }).filter((name) => /\.(tsx|ts)$/.test(name))) {
    const relative = path.join(root, String(file));
    const source = ts.createSourceFile(relative, fs.readFileSync(relative, "utf8"), ts.ScriptTarget.Latest, true, relative.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    walk(source, relative);
  }
}

const checkIndex = process.argv.indexOf("--check");
if (checkIndex >= 0) {
  const dictionaryPath = process.argv[checkIndex + 1];
  if (!dictionaryPath) throw new Error("--check requires a generated dictionary path");
  const dictionary = { ...JSON.parse(fs.readFileSync(dictionaryPath, "utf8")), ...JSON.parse(fs.readFileSync("lib/i18n/workshop-ar.json", "utf8")) };
  const allStrings = new Set([...results.values()].flatMap((strings) => [...strings]));
  const missing = [...allStrings].filter((value) => !(value in dictionary)).sort((a, b) => a.localeCompare(b));
  if (missing.length) {
    console.error(`Missing ${missing.length} Arabic translations:\n${missing.join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log(`Arabic coverage complete: ${allStrings.size} audited strings.`);
  }
} else if (process.argv.includes("--buttons")) {
  for (const value of [...buttons].sort((a, b) => a.localeCompare(b))) console.log(value);
} else {
  for (const [file, strings] of [...results].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`\n# ${file}`);
    for (const value of [...strings].sort((a, b) => a.localeCompare(b))) console.log(value);
  }
}
