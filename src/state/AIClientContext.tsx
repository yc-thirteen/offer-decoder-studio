/**
 * Which AI client the page uses. By default it is getAIClient(): the HTTP client when the
 * Lovable Cloud env vars are present, the mock otherwise. Tests pass their own client.
 */
import { createContext, useContext, type ReactNode } from "react";
import { getAIClient, type AIClient } from "@/lib/ai";

const AIClientContext = createContext<AIClient | null>(null);

let defaultClient: AIClient | null = null;

export function AIClientProvider({ client, children }: { client: AIClient; children: ReactNode }) {
  return <AIClientContext.Provider value={client}>{children}</AIClientContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAIClient(): AIClient {
  const client = useContext(AIClientContext);
  if (client) return client;
  defaultClient ??= getAIClient();
  return defaultClient;
}
