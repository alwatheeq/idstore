import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

// Source-level guard, not a substitute for rendered accessibility/layout tests.
// Native controls need a persistent label; placeholder text does not count.
const failures = [];
let controls = 0;
let files = 0;
let actions = 0;
function hasContent(children) {
  return children.some(child =>
    ts.isJsxText(child) ? Boolean(child.text.trim()) :
      ts.isJsxExpression(child) ? Boolean(child.expression) :
        ts.isJsxElement(child) ? hasContent(child.children) : false);
}
const value = (element, key) => {
  const attr = element.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText() === key);
  if (!attr?.initializer) return "";
  return ts.isStringLiteral(attr.initializer) ? attr.initializer.text : attr.initializer.getText();
};
for (const root of ["app", "components"]) {
  for (const relative of fs.readdirSync(root, { recursive: true }).filter(file => file.endsWith(".tsx"))) {
    const file = path.join(root, relative);
    const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const labels = new Set();
    files++;
    function collect(node) {
      if (ts.isJsxOpeningElement(node) && node.tagName.getText() === "label") labels.add(value(node, "htmlFor"));
      ts.forEachChild(node, collect);
    }
    collect(source);
    function visit(node) {
      if (ts.isJsxElement(node) && ["button", "a", "Link"].includes(node.openingElement.tagName.getText())) {
        actions++;
        if (!hasContent(node.children) && !["aria-label", "aria-labelledby", "title"].some(key => value(node.openingElement, key))) {
          const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          failures.push(`${file}:${line}: action needs text or an accessible name`);
        }
      }
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText();
        if (["input", "select", "textarea"].includes(tag) && value(node, "type") !== "hidden") {
          controls++;
          let wrapped = false;
          for (let parent = node.parent; parent; parent = parent.parent) {
            if (!ts.isJsxElement(parent)) continue;
            const name = parent.openingElement.tagName.getText();
            if (["label", "LabeledControl"].includes(name)) { wrapped = true; break; }
            if (name === "form") break;
          }
          const id = value(node, "id");
          // Country pickers are parts of a phone field; topbar search is an
          // intentionally compact, icon-led navigation control.
          const compactSearch = file === "components/app-shell.tsx" && value(node, "name") === "q";
          const countryPicker = tag === "select" && value(node, "name") === "dialCode";
          const exception = (compactSearch || countryPicker) && value(node, "aria-label");
          if (!wrapped && !(id && labels.has(id)) && !exception) {
            const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
            failures.push(`${file}:${line} ${tag} ${value(node, "name") || id || "(unnamed)"}: needs an associated visible label`);
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
console.log(`Audited ${controls} native controls and ${actions} actions across ${files} TSX files.`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else console.log("All controls have associated labels (documented compact/composite exceptions only).");
