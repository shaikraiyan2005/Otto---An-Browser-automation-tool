import { installEngine } from "@otto/core";

/** Injected on demand into each frame with scripting.executeScript. Never declared as a content script. */
export default defineUnlistedScript(() => {
  installEngine(browser as unknown as Parameters<typeof installEngine>[0]);
});

