// Lovable Cloud (Supabase) edge function: a plain-English summary of two stubs,
// worded only from the engine numbers it is sent. Uses the managed LOVABLE_API_KEY secret.
import { handleExplainStub } from "../_shared/explainStub.ts";

Deno.serve((req) => handleExplainStub(req, { apiKey: Deno.env.get("LOVABLE_API_KEY") }));
