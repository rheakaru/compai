---
title: Vanaja — a voice HR partner that speaks everyone's language
dek: A vernacular voice HR agent for warehouse teams, built on Sarvam's speech models.
tags: voice-ai, vernacular, sarvam, hoovu, latency
source: https://rheakaru.github.io/projects/vanaja.html
---

An HR partner who speaks *your language*.

Vanaja is a warm, talking AI HR partner for our warehouse packing teams — built on Sarvam's Indian speech models. She greets a team member by name, in their own language, and talks them through their month's pay and attendance. Most of the people she serves haven't studied much and don't share a common tongue, so she had to listen and speak in nine languages — and she had to do it fast enough to feel like a real conversation.

Built and designed in-house by **Rhea Karuturi**, CTO & co-founder, Hoovu Fresh.

- 9 — Languages
- ~600ms — To first word
- 4–8s → 0.6s — Latency cut
- 2 — Sarvam models

## 01 — The use case

### Pay-day, as a conversation

Every month our warehouse teams want to understand their pay — how many days they worked, what overtime added, what a missed day cost. On paper that's a slip most of them can't easily read. Vanaja turns it into a conversation: HR opens her on a shared device, picks the team member and a month, and she does the rest, out loud, hands-free.

#### A monthly salary call

**She greets you, by name and in your language** — HR picks an active employee and a language; Vanaja opens warmly and introduces herself — no buttons for the team member to press.

**You just talk** — She listens through the device mic, auto-detecting a ~900ms pause to know you've finished, then replies. Pause, resume, or end any time.

**She explains the month** — Base pay, overtime added, undertime or loss-of-pay deducted — all computed server-side from trusted attendance logs and handed to her as context, so she never invents a number.

**She knows what's not hers to say** — She won't quote a single final "take-home" figure (payroll confirms that), never reveals anyone else's pay, and flags sensitive issues — a dispute, a safety worry, someone wanting to quit — to a human via a quiet `[[HANDOFF]]` token.

There's a second, gentler mode too: a text-and-voice **team chat** where the same Vanaja answers everyday questions and nudges people to build skills — sealing machines, garland-making, using the app — while staying inside the same confidentiality rails.

The hands-free salary call — Vanaja greets in Kannada and the team member just speaks back.

## 02 — The vernacular bit

### Nine languages, one warehouse

This was the whole reason to build her. A generic English voice assistant is useless on our floor — our teams speak Kannada, Telugu, Tamil, Malayalam, Hindi, and more, and many can't read a payslip in any script. Vanaja listens *and* speaks in each of these, in the language's own script, using Sarvam's India-first speech models.

- ಕನ್ನಡ — Kannada — `kn-IN`
- తెలుగు — Telugu — `te-IN`
- தமிழ் — Tamil — `ta-IN`
- മലയാളം — Malayalam — `ml-IN`
- हिन्दी — Hindi — `hi-IN`
- मराठी — Marathi — `mr-IN`
- ગુજરાતી — Gujarati — `gu-IN`
- বাংলা — Bengali — `bn-IN`
- English — Indian English — `en-IN`

### Sarvam · the ears — saarika:v2.5

- Speech-to-text tuned for Indian languages and accents.
- Language can be pinned to the chosen tongue, or left on `auto` to detect it.
- Browsers record WebM/Opus, which Sarvam won't take — so I resample to 16 kHz mono and hand-encode a 16-bit PCM WAV in the browser before sending.

### Sarvam · the voice — bulbul:v2

- Natural Indian text-to-speech, with named speakers (a warm female voice by default).
- Claude is told to answer *only* in the target language, in its own script, with simple words.
- Same pipeline drives the team chat's optional voice replies.

Claude Sonnet sits between the ears and the voice as the brain — it gets the salary context, the personality ("warm, caring, encouraging"), and the confidentiality rules, and produces the words. Sarvam makes those words sound like a person from down the road, not a call-centre robot.

## 03 — The streaming breakthrough

### Making her feel quick

The first version was correct but painful. We'd wait for the whole Claude reply, then send all of it to Sarvam for speech, then play it. That serial chain left a **4–8 second** silence after every sentence — long enough that people thought the call had dropped and started talking over her.

The painful first version — those 4–8 seconds of silence are what listeners actually heard.

The fix came from **Sneha on the Sarvam team**. Her advice was simple and exactly right: *don't wait for the full answer — stream it*. Speak each sentence the moment it's finished instead of holding the whole paragraph. Sarvam has a streaming TTS endpoint built for precisely this, and pairing it with Claude's token stream changes the feel of the whole thing.

So `vanajaSpeak` now runs a small pipeline:

`functions/index.js · vanajaSpeak — sentence-streamed TTS`

```js
// 1 · stream Claude; buffer tokens until a sentence ends
for await (const delta of claudeStream) {
  buffer += delta.text;
  const m = buffer.match(SENT_RE);          // . ! ? or । danda, ≥10 chars
  if (m) { flushSentence(m[1]); buffer = m[3]; }
}

// 2 · each finished sentence → Sarvam streaming TTS → mp3 chunks
async function _sarvamTtsStream(text, language, speaker, key) {
  const r = await fetch("https://api.sarvam.ai/text-to-speech/stream", {
    method: "POST",
    headers: { "api-subscription-key": key },
    body: JSON.stringify({
      text, target_language_code: language, speaker,
      model: "bulbul:v2", output_audio_codec: "mp3",
    }),
  });
  return { kind: "stream", body: r.body, mime: "audio/mpeg" };
}

// 3 · chain flushes so audio stays in order, pipe chunks to the browser as SSE
let pendingTail = Promise.resolve();
function flushSentence(sent) {
  pendingTail = pendingTail.then(() => flushSentenceImmediate(sent));
}
```

**The trick:** the browser feeds those MP3 chunks into a `MediaSource` buffer, so sentence two is already generating while sentence one is still playing — gapless, and the first word lands almost immediately.

### What it bought us

- Before — serial STT → full reply → TTS → play: **~4–8s**
- After — per-sentence streaming TTS: **~600ms**

Time-to-first-word dropped from a multi-second wait to roughly **600ms** — about an order of magnitude. That's the difference between a tool people tolerate and one they actually talk to. And it degrades gracefully: if streaming TTS isn't available it falls back to a single Sarvam WAV, and in the very last resort to the browser's own speech synthesis.

## 04 — Built in public

### How the fix actually arrived

I'd posted about Vanaja and the latency problem on Twitter — half a build-log, half a confession that she wasn't fast yet. A few hours later, **Sneha at Sarvam** (who, it turns out, leads everything Sarvam APIs) slid into my DMs with the exact fix that ended up halving the silence. The whole streaming move above started here.

> **sneha** — @itspsneha · DM
>
> hey rhea firstly this is amazing — can you share how you are using our APIs here? **ideally you should be streaming the response so it would be faster.**
>
> (we work day and night on latencies so it shouldn't be this high, especially in a voice-agent usecase)
>
> have seen you on shark tank long back — it's amazing to interact with you like this

> **sneha** — a few minutes later
>
> yeah amazing — just give claude/cursor our docs and it should be able to figure out. team would love it.
>
> ps. i lead everything Sarvam APIs so happy to help you in any way possible.

*The shortest distance between a problem and the right person is often a public post.*

## 04 — Under the hood

### How it's put together

**Frontend**

- `vanajaCall.js` — hands-free call UI, silence detection, `MediaSource` playback
- `vanajaChat.js` — text + optional voice
- In-browser WebM → 16kHz PCM WAV transcode

**Speech**

- Sarvam `saarika:v2.5` STT
- Sarvam `bulbul:v2` TTS
- Streaming `/text-to-speech/stream` endpoint

**Brain**

- Claude Sonnet 4, streamed
- Persona + confidentiality + language rules in the system prompt
- Salary context computed from attendance logs

**Backend**

- Firebase Cloud Functions: `vanajaSpeak`, `vanajaTTS`, `vanajaSTT`, `vanajaSalaryData`
- Server-sent events to stream audio out

> The hard part of a vernacular voice agent isn't the languages — it's making it quick enough that someone forgets they're talking to software.

What I'm proudest of is that Vanaja meets people where they are: in their language, out loud, with no app to install and nothing to read. Sarvam's models made the vernacular possible, and Sneha's one piece of advice — stream sentence by sentence — made it feel human. Together they turned a once-a-month sheet of numbers most of our team couldn't read into a two-minute conversation they can have in their mother tongue.

Sarvam saarika:v2.5 · Sarvam bulbul:v2 · Streaming TTS · Claude Sonnet 4 · Firebase Functions · MediaSource / SSE · 9 languages
