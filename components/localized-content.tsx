"use client";

import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import { useUiLocale } from "@/components/ui-locale";
import { isolateNumericText } from "@/lib/i18n/bidi";

function translateText(source: string, translate: (value: string) => string, isolate: boolean) {
  const value = source.trim();
  if (!value) return source;
  const translated = /[A-Za-z]/.test(value) && !/^[A-Z0-9 .:/+%°_-]+$/.test(value) ? translate(value) : value;
  const rendered = `${source.slice(0, source.indexOf(value))}${translated}${source.slice(source.indexOf(value) + value.length)}`;
  return isolate ? isolateNumericText(rendered) : rendered;
}

/** Render translated children; never mutate DOM owned by React or a pending
 * streaming boundary. Place this inside the page, not around LayoutRouter. */
function translateNodes(children: ReactNode, translate: (value: string) => string, isolate: boolean, controlName = false): ReactNode {
  // Children.map always wraps a scalar in an array. Preserve text-valued
  // children used by client components such as LocalizedText in server trees.
  if (typeof children === "string") return translateText(children, translate, isolate && !controlName);
  if (children == null || typeof children === "number" || typeof children === "boolean") return children;
  return Children.map(children, child => {
    if (typeof child === "string") return translateText(child, translate, isolate && !controlName);
    if (!isValidElement<Record<string, unknown>>(child)) return child;
    const tag = typeof child.type === "string" ? child.type : "";
    if (["script", "style", "code", "pre", "bdi"].includes(tag) || child.props.translate === "no") return child;
    const props: Record<string, unknown> = {};
    for (const attribute of ["aria-label", "placeholder", "title"]) {
      if (typeof child.props[attribute] === "string") props[attribute] = translateText(child.props[attribute], translate, false);
    }
    if ("children" in child.props) {
      props.children = translateNodes(child.props.children as ReactNode, translate, isolate, controlName || tag === "label" || tag === "option");
    }
    return cloneElement(child, props);
  });
}

export function LocalizedContent({ children }: { children: ReactNode }) {
  const { locale, pageText } = useUiLocale();
  return <div className="localized-content">{translateNodes(children, pageText, locale === "ar")}</div>;
}
