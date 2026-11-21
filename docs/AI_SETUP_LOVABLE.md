# Connecting the AI features in Lovable

Offer Decoder has two AI features: **Read offer letter** and the **Plain-English summary**. Out of the box, both run on a mock client that needs no key:

- The sample reader reads only the three sample letters.
- The sample writer fills a fixed template with the engine's numbers.

The real path is already built and tested. Two Lovable Cloud (Supabase) edge functions call the Anthropic API:

- `supabase/functions/decode-offer`
- `supabase/functions/explain-stub`

The browser switches to them automatically once the Cloud URL and publishable key are in the build.

**The only human step is adding the Anthropic API key as a secret.** Everything else is a prompt you paste into Lovable.

## What you need

- The Lovable project for this repo, open in the editor.
- An Anthropic API key from [console.anthropic.com](https://console.anthropic.com) (Settings → API keys). It starts with `sk-ant-`. Keep it out of chat messages, code, and commits.

## Steps

### 1. Enable Lovable Cloud and deploy the functions

Paste this prompt into the Lovable chat as is:

```text
Enable Lovable Cloud for this project if it isn't enabled yet.

Then deploy the two edge functions that already exist in the repo, without changing their code:
- supabase/functions/decode-offer (index.ts)
- supabase/functions/explain-stub (index.ts)
Both import shared code from supabase/functions/_shared/ (anthropic.ts, decodeOffer.ts, explainStub.ts). Deploy that folder with them and leave it unchanged too.

Both functions are called from the browser with the project's publishable key, and there is no user login. Set verify_jwt = false for both functions in supabase/config.toml.

Make sure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are available to the frontend build. The app reads them in src/lib/ai/index.ts.

Don't add a database table, change any other file, or move these calls to a different AI provider or gateway.

When you're done, ask me to add a secret named ANTHROPIC_API_KEY.
```

Why these instructions:

- **The functions stay unchanged.** They're covered by tests in `src/lib/ai/edgeFunctions.test.ts`, which check that all three sample letters round-trip through `decode-offer` into the fixture offers. The tests also check that `explain-stub` rejects any number that isn't on the stubs.
- **`verify_jwt = false`.** The app has no sign-in. Newer publishable keys (`sb_publishable_…`) aren't JWTs, so with JWT verification on, every call returns 401.
- **The provider stays Anthropic.** The project spec names the Anthropic API and model `claude-sonnet-5-5`. Lovable lets a project bring its own key for a provider when Lovable doesn't supply one, and the key is read only inside the functions.

### 2. Add the `ANTHROPIC_API_KEY` secret (the human step)

1. When Lovable asks for the secret, paste your Anthropic key into its secure secret field. Don't paste it into the chat. If Lovable doesn't ask, open **Cloud → Secrets** and add it there.
2. The name must be exactly `ANTHROPIC_API_KEY`.
3. Save it. The functions read it on their next call, so you don't need to redeploy.

The key never reaches the browser:

- The functions read it with `Deno.env.get("ANTHROPIC_API_KEY")`.
- The browser only sends the publishable key, which is public by design.

### 3. Publish

Publish (or update) the site so the build picks up the Cloud URL and publishable key.

## Confirm it's working

### In the app

1. Open the site and choose **Read offer letter** on either stub.
2. The panel should no longer say "Sample reader: works on the three sample letters until an API key is connected." If that note is still there, the build is still on the mock. See Troubleshooting below.
3. Paste the test letter below and choose **Read offer letter**. After a few seconds:
   - The stub fills in.
   - Each field the letter stated shows a "from letter" marker.
   - Anything it didn't state is underlined in red, with a note telling you what to type in.
4. Save the offer, then load a second offer (a sample works).
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

If the reader leaves a field or two missing, that's correct behavior. It copies only what the letter states and never guesses.

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

An empty `text` returns HTTP 400 with `{"error": "The letter is empty. Paste its text or drop a .txt file."}`. That error shows the function is deployed even before the secret is added.

## Troubleshooting

| What you see                                                                                                                  | What it means                                                                                                                                                     | What to do                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| The "Sample reader" note is still in the panel                                                                                | The published build has no `VITE_SUPABASE_URL` or publishable key, so it chose the mock                                                                           | Ask Lovable: "Make VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY available to the frontend build, then republish." |
| "The letter reader isn't connected yet. Add the ANTHROPIC_API_KEY secret in Lovable Cloud, or type the offer in by hand."     | The function is deployed, but the secret is missing or misnamed                                                                                                   | Add the secret named exactly `ANTHROPIC_API_KEY` (step 2)                                                                |
| "The summary writer isn't connected yet. Add the ANTHROPIC_API_KEY secret in Lovable Cloud, or read the stubs and checklist." | The same as above, for the summary                                                                                                                                | The same as above                                                                                                        |
| "Couldn't reach the letter reader…" or "The letter reader didn't answer…", and the terminal check returns 401                 | JWT verification is on, and the publishable key isn't a JWT                                                                                                       | Ask Lovable: "Set verify_jwt = false for decode-offer and explain-stub in supabase/config.toml and redeploy them."       |
| "…couldn't reach the model…"                                                                                                  | The Anthropic API rejected the call: a wrong or revoked key, no credits, or the API is overloaded. The function logs show the status code, never the letter text. | Check the key and billing in the Anthropic console, then try again                                                       |
| "The letter reader took longer than 20 seconds…"                                                                              | The model was slow, and the browser gave up                                                                                                                       | Try again. Very long letters are slower, so paste only the offer and benefits sections.                                  |
| "The summary writer used a number that isn't on your stubs, so it wasn't shown…"                                              | The safety check caught the model inventing a figure                                                                                                              | Ask again. This is the check working as intended.                                                                        |

## What is and isn't mocked

| Feature                                    | Without the key (mock)                                                                                               | With the key                                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Read offer letter                          | Reads only the three sample letters. For any other text, it says it reads only the samples and never invents values. | Reads any pasted letter. It copies only stated values and marks the rest missing.                                  |
| Plain-English summary                      | Writes itself from a fixed template, built only from engine numbers                                                  | Writes on request with `claude-sonnet-5-5`, from the same engine numbers. Any figure not on the stubs is rejected. |
| All pay, tax, benefits, and checklist math | The engine in `src/lib/engine/`, always                                                                              | Unchanged. The model never does the math.                                                                          |
