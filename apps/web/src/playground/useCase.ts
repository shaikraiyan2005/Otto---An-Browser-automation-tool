"use client";

import { useEffect, useRef } from "react";

type Values = Record<string, unknown>;

declare global {
  interface Window {
    __ottoCase?: { id: string; read: () => Values | Promise<Values> };
  }
}

/** Registers the case with the scorer: the scorer reads the app's own state through `read`. */
export function useCase(id: string, read: () => Values) {
  const ref = useRef(read);
  ref.current = read;
  useEffect(() => {
    window.__ottoCase = { id, read: () => ref.current() };
    let meta = document.querySelector<HTMLMetaElement>('meta[name="otto-case"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "otto-case";
      document.head.appendChild(meta);
    }
    meta.content = id;
  }, [id]);
}
