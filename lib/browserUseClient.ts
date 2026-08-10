import { realBrowserUseClient, type BrowserUseClient } from "@/lib/browserUse";
import { stubBrowserUseClient } from "@/lib/browserUseStub";

export function getBrowserUseClient(): BrowserUseClient {
  return process.env.BROWSER_USE_STUB === "true" ? stubBrowserUseClient : realBrowserUseClient;
}
