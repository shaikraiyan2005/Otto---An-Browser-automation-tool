import { Readability } from "@mozilla/readability";
import type { PageText } from "@otto/shared";
import { clean } from "./util";

export function extractText(): PageText {
  let text = "";
  try {
    const article = new Readability(document.cloneNode(true) as Document, { charThreshold: 300 }).parse();
    text = article?.textContent ?? "";
  } catch {
    text = "";
  }
  if (text.trim().length < 400) {
    const main = document.querySelector("main,[role=main],article") as HTMLElement | null;
    text = (main ?? document.body).innerText;
  }
  text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 60000);
  const headings = [...document.querySelectorAll("h1,h2,h3")].map((h) => clean(h.textContent, 100)).filter(Boolean).slice(0, 60);
  return {
    url: location.href,
    title: document.title,
    text,
    headings,
    forms: document.forms.length,
    tables: document.querySelectorAll("table").length,
    links: document.links.length,
  };
}
