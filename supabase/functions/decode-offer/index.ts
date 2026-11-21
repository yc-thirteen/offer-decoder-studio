// Lovable Cloud (Supabase) edge function: reads an offer letter into fields.
// Uses the managed LOVABLE_API_KEY secret. The letter text is never logged.
import { handleDecodeOffer } from "../_shared/decodeOffer.ts";

Deno.serve((req) => handleDecodeOffer(req, { apiKey: Deno.env.get("LOVABLE_API_KEY") }));
