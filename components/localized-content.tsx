"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useUiLocale } from "@/components/ui-locale";

type TextRecord = { source: string; rendered: string };
type AttributeRecord = { source: string; rendered: string };
const textRecords = new WeakMap<Text, TextRecord>();
const attributeRecords = new WeakMap<Element, Map<string, AttributeRecord>>();
const translatableAttributes = ["aria-label", "placeholder", "title"] as const;

function preserveWhitespace(source: string, translate: (value: string) => string) {
  const value = source.trim();
  if (!value || !/[A-Za-z]/.test(value)) return source;
  if (/^[A-Z0-9 .:/+%°_-]+$/.test(value)) return source;
  const translated = translate(value);
  if (translated === value) return source;
  return `${source.slice(0, source.indexOf(value))}${translated}${source.slice(source.indexOf(value) + value.length)}`;
}

function translateTree(root: HTMLElement, translate: (value: string) => string) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const current = textNode.data;
    const previous = textRecords.get(textNode);
    const source = previous && current === previous.rendered ? previous.source : current;
    const rendered = preserveWhitespace(source, translate);
    textRecords.set(textNode, { source, rendered });
    if (current !== rendered) textNode.data = rendered;
    node = walker.nextNode();
  }

  for (const element of root.querySelectorAll("[aria-label], [placeholder], [title]")) {
    const records = attributeRecords.get(element) ?? new Map<string, AttributeRecord>();
    for (const attribute of translatableAttributes) {
      const current = element.getAttribute(attribute);
      if (!current) continue;
      const previous = records.get(attribute);
      const source = previous && current === previous.rendered ? previous.source : current;
      const rendered = preserveWhitespace(source, translate);
      records.set(attribute, { source, rendered });
      if (current !== rendered) element.setAttribute(attribute, rendered);
    }
    attributeRecords.set(element, records);
  }
}

export function LocalizedContent({ children }: { children: ReactNode }) {
  const { pageText } = useUiLocale();
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    translateTree(root, pageText);
    const observer = new MutationObserver(() => translateTree(root, pageText));
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...translatableAttributes] });
    return () => observer.disconnect();
  }, [pageText]);

  return <div className="localized-content" ref={rootRef}>{children}</div>;
}
