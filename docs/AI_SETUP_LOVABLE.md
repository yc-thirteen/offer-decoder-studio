# The AI features and Lovable AI

Offer Decoder has two AI features, **Upload documents** and the **Plain-English summary**. Both run through two Lovable Cloud (Supabase) edge functions:

- `supabase/functions/decode-offer` reads a letter into the stub's fields.
- `supabase/functions/explain-stub` writes the summary from the engine's numbers.

Both functions call `anthropic/claude-sonnet-5` through the **Lovable AI Gateway**, using the `@lovable.dev/ai-gateway` SDK. Their shared code is in `supabase/functions/_shared/`, and the SDK version is pinned in `import_map.json`. Usage is billed to the workspace's Lovable AI credits, and there's no separate AI account or key to manage.

The browser switches from the mock client to these functions on its own when `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are in the build. The app reads them in `src/lib/ai/index.ts`. Without them, both features run on a mock that needs nothing:

- The sample reader reads only the three sample letters.
- The sample writer fills a fixed template with the engine's numbers.

## How it's set up

The original hosted project has Cloud and AI configured. A local checkout still needs the public frontend environment values, and branch changes to edge functions require deployment. The existing setup is:

- Lovable Cloud and Lovable AI are on for the project.
- Lovable creates and manages `LOVABLE_API_KEY`. The functions read it with `Deno.env.get("LOVABLE_API_KEY")` and pass it to the SDK. It never reaches the browser, and it shouldn't go in the repo or in `.env` files.
- Both functions have `verify_jwt = false` in `supabase/config.toml`. The app has no sign-in, and the browser calls the functions with the publishable key, which is public by design. Newer publishable keys (`sb_publishable_…`) aren't JWTs, so with JWT verification on, every call would return 401.
- The model never does the math. It copies what a letter states, or words numbers the engine already computed. Both answers are checked against a JSON schema in the function, then checked again in the browser (`src/lib/ai/validate.ts`).

To change the model or the gateway setup, ask Lovable in the project chat. Keep the handler contract in `supabase/functions/_shared/anthropic.ts` (`callModel` returns JSON matching the schema it's given), because the tests in `src/lib/ai/edgeFunctions.test.ts` cover it.

## Confirm it's working

### In the app

1. Open the published site and choose **Upload documents** on either stub.
2. The panel should no longer say "Sample reader: works on the three sample letters until the AI is connected." If that note is still there, the build is still on the mock. See Troubleshooting below.
3. Paste the test letter below into **Offer letter**, and optionally add a separate guide in **Benefits guide — optional**. Choose **Fill from documents**. After a few seconds:
   - The stub fills in.
   - Each field the letter stated shows a "from documents" marker.
   - Anything it didn't state is underlined in red, with a note telling you what to type in.
4. Save the offer. Its yearly result and fixed plain-English summary appear immediately. Then load a second offer (a sample works) to test the AI comparison writer.
5. Under the memo line, the **Plain-English summary** now shows a **Write plain-English summary** button instead of writing itself. The sample-writer note is gone.
6. Choose the button. A three- or four-sentence summary appears, and every number in it matches the stubs.

The test letter (fictional, and not one of the samples):

```text
Dear Jordan,

We are pleased to offer you the role of Analyst at Riverbend Analytics in Denver, Colorado.
Your base salary will be $88,000 per year, paid semimonthly (24 paychecks a year).

401(k): we match 100% of your contributions up to 4% of salary. New hires are enrolled
at 3% of pay into the traditional 401(k). Matching contributions vest 25% per year over four years.

Health: you may choose the Standard PPO (employee premium $1,800 per year, deductible $1,000,
out-of-pocket maximum $4,000, 20% coinsurance) or the HDHP with HSA (employee premium $600 per year,
deductible $3,000, out-of-pocket maximum $6,000, 10% coinsurance, employer HSA contribution $750).
New hires default to the Standard PPO.

Life insurance: basic coverage of 1x salary at no cost.

Sincerely,
People Team
```

If the reader leaves a field or two missing, that's correct behavior. It copies only what the letter states and never guesses. Many real offer letters leave the health plan details out and put them in a separate benefits summary. Add that summary in the separate benefits-guide input. The reader combines the two documents; a missing or ambiguous value still needs review.

### From a terminal (optional)

Replace the two placeholders with your project's values. Both are in Lovable under **Cloud → Settings** (or in the frontend's `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`). Neither is a secret.

```sh
curl -s -X POST "https://YOUR-PROJECT-REF.supabase.co/functions/v1/decode-offer" \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR-PUBLISHABLE-KEY" \
  -H "Authorization: Bearer YOUR-PUBLISHABLE-KEY" \
  -d '{"text": "Riverbend Analytics offers you $88,000 a year in Denver, Colorado, paid in 24 paychecks."}'
```

A working setup returns `{"fields": {...}}`:

- Every field has `"source": "letter"` or `"source": "missing"`.
- For this short text, most fields are missing.

An empty `text` returns HTTP 400 with `{"error": "The letter is empty. Paste its text or drop the letter's file."}`. That shows the function is deployed, without spending any AI credits.

## Troubleshooting

| What you see                                                                                                    | What it means                                                                                              | What to do                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| The "Sample reader" note is still in the panel                                                                  | The published build has no `VITE_SUPABASE_URL` or publishable key, so it chose the mock                    | Ask Lovable: "Make VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY available to the frontend build, then republish."        |
| "The letter reader isn't connected yet. Turn on Lovable AI for this project, or type the offer in by hand."     | The gateway rejected the function's credentials, or Lovable AI is off                                      | Ask Lovable: "Make sure Lovable AI is enabled and LOVABLE_API_KEY is available to the decode-offer and explain-stub functions." |
| "The summary writer isn't connected yet. Turn on Lovable AI for this project, or read the stubs and checklist." | The same as above, for the summary                                                                         | The same as above                                                                                                               |
| "…is out of Lovable AI credits…"                                                                                | The workspace used up its AI credits (the gateway returned 402)                                            | Add credits in Lovable's workspace settings, then try again                                                                     |
| "…is busy. Wait a minute…"                                                                                      | The workspace hit the gateway's per-minute request limit (429)                                             | Wait a minute, then try again                                                                                                   |
| "Couldn't reach the letter reader…" or "The letter reader didn't answer…", and the terminal check returns 401   | JWT verification is on, and the publishable key isn't a JWT                                                | Ask Lovable: "Set verify_jwt = false for decode-offer and explain-stub in supabase/config.toml and redeploy them."              |
| "…couldn't reach the model…"                                                                                    | The gateway call failed for another reason. The function logs show the status code, never the letter text. | Try again. If it keeps happening, check the function logs in Lovable Cloud.                                                     |
| "The letter reader took longer than 20 seconds…"                                                                | The model was slow, and the browser gave up                                                                | Try again. Very long letters are slower, so paste only the offer and benefits sections.                                         |
| "The summary writer used a number that isn't on your stubs, so it wasn't shown…"                                | The safety check caught the model inventing a figure                                                       | Ask again. This is the check working as intended.                                                                               |

## What is and isn't mocked

| Feature                                    | Without the Cloud env vars (mock)                                                                         | With Lovable AI connected                                                                                                             |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Upload documents                           | Reads the three sample letters and the split Northfield document pair. Other employers need manual entry. | Reads offer and benefits text from pasted content, .txt, PDF, or Word files. It copies only stated values and marks the rest missing. |
| One-offer plain-English summary            | A fixed template words the engine's numbers immediately.                                                  | The same fixed template; no model call.                                                                                               |
| Two-offer preset plain-English summary     | Writes itself from a fixed template, built only from engine numbers                                       | Writes on request with `anthropic/claude-sonnet-5`, from the same engine numbers. Any figure not on the stubs is rejected.            |
| All pay, tax, benefits, and checklist math | The engine in `src/lib/engine/`, always                                                                   | Unchanged. The model never does the math.                                                                                             |

PDF and Word files are turned into text in the browser (`src/lib/letterFile.ts`), on both paths. Original files are not uploaded by the app. Their text is sent for processing only after **Fill from documents**. Uploaded drafts and entered offers live in memory and disappear on refresh. The app does not persist the files or text; cloud processing follows the configured service’s handling of requests.

## Document intake version 1

The browser still posts `{ "text": "..." }` to `decode-offer`. For two-document intake, the text contains a JSON envelope with `kind: "offer-decoder-documents-v1"`, `coverage: "self"` or `"family"`, `offerLetter`, and `benefitsGuide`. Plain-letter requests from earlier clients remain supported. The shared parser is in `supabase/functions/_shared/offerDocuments.ts`; it contains no browser or runtime dependencies.

The edge function puts validated coverage context in the system instructions and sends the two source texts as untrusted data. It asks for matching coverage tiers, known premium frequencies, complementary facts across documents, and manual review of contradictions. The extracted-fields response and its legacy `source: "letter"` enum are unchanged; the UI calls these values **from documents**. Missing plan fields still use the existing complete-plan contract. This is not OCR, and no silent fallback fills absent values with typical benefits.

The 40,000-character limit applies to the complete serialized text envelope. For long guides, paste the medical and retirement sections that apply. Switching profile coverage during extraction cancels the request; review every plan’s costs for the selected tier before saving. The offline sample reader cannot establish real-document extraction quality.

## Check the feature branch against the deployed function

Changes on `codex/offer-intake-v1` do not update the connected `main` deployment automatically. To test the new server instructions, deploy the updated `decode-offer` shared files to a suitable project using the existing managed Lovable gateway and secret. The explanatory wording update also touches the `explain-stub` shared handler. Preserve no-login access, existing endpoint contracts, and the managed secret; no database changes are required.

Use a fictional offer stating salary and pay frequency, plus a separate fictional guide stating monthly employee premiums, both self/family tiers, match, vesting, and HSA terms. Test both coverage choices; verify every extracted annual premium and tier against the source before saving. Repeat with a conflicting salary and an unspecified premium frequency: unresolved fields should be left for manual review. Local tests use a mocked gateway and do not prove the model will extract these cases correctly in a deployed environment.

With no frontend cloud environment configured, the local app explicitly remains in sample-reader mode. Configure the public project URL and publishable key in the ignored `.env.local` to connect to a deployed function. Never put `LOVABLE_API_KEY` in that file or browser code.

The monthly planner and custom elections use the local finance engine. In **My plan**, both one-offer and two-offer summaries are formatted locally from the active calculations; no custom mode is sent to the legacy `explain-stub` endpoint. This feature requires no database, secret, or edge-function changes. The document-intake deployment steps above remain a separate integration task.
