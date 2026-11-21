// Lovable Cloud (Supabase) edge function: reads an offer letter into fields.
// Needs the ANTHROPIC_API_KEY secret. The letter text is never logged.
import { handleDecodeOffer } from "../_shared/decodeOffer.ts";

Deno.serve((req) => handleDecodeOffer(req, { apiKey: Deno.env.get("ANTHROPIC_API_KEY") }));
