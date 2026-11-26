---
title: A room full of founders, each building their own chief of staff
dek: Notes from Ignite.AI in Bengaluru, a day by SonderConnect with Anthropic and AWS, where I ran the largest Rhai workshop yet. Everyone left with a working AI chief of staff, and I also built the backend the conference ran on.
tags: workshop, agents, chief-of-staff, anthropic, aws, event
readingMinutes: 8
---

<!--
  NOTE: this file supplies the archive listing (title, dek, tags, reading time)
  only. The page itself is hand-designed and rendered by
  app/writing/ignite-ai-chief-of-staff/page.tsx + components/IgniteCaseStudy.tsx —
  edit the copy there, not here.
-->

On 19 November, SonderConnect ran **Ignite.AI** at The Sabha in Bengaluru: a full day for founders, operators and tech teams, with **Anthropic** and **WhiteMatter** as partners and **AWS** as title sponsor. There were two tracks. Tech teams spent the day in the Tech Hall, shipping agents on Amazon Bedrock AgentCore with AWS solutions architects and learning evals from Anthropic. Founders and operators had the Main Hall.

My slot was the Main Hall after lunch: two hours called *Build your Chief of Staff agent*. It was the largest workshop I've run for Rhai. The round tables were full, laptops were open, and a lot of people were building an agent for the first time.

![Welcome and context setting in the Main Hall at The Sabha](/img/writing/ignite-ai/welcome.jpg)

## A build, not just a talk

People leave most AI talks with a few screenshots and a vague plan to "try it." I wanted everyone to leave this one with a working agent built around their own week, so 45 minutes of the session was hands-on building.

The session had four parts:

- **Define.** What an LLM is, what an agent is, and what a chief of staff actually does.
- **See.** Live demos of agents I use every day.
- **Build.** Everyone builds their own, one guided question at a time.
- **Zoom out.** What this means for roles and companies.

![Rhea presenting the Hoovu context graph to a packed Main Hall](/img/writing/ignite-ai/hall.jpg)

## Seven words, and one analogy

Before anyone built anything, we went through seven terms: LLM, prompt, context, connector, skill, project and agent. Each got one plain sentence. An LLM predicts the next word. A prompt works because it's specific, not because of magic words. Context is everything the model can see at once, and if something isn't in it, the model doesn't know it.

The seventh was the one that mattered most: **an agent is an LLM that can do things.** A chatbot talks about your calendar. An agent opens it.

![Slide: An Agent is an LLM that can do things](/img/writing/ignite-ai/agent.jpg)

An agent runs a loop: **think, act, reflect.** Ask it to prep you for your 3pm. It works out that it needs the invite and the attendee list, opens the calendar, searches your inbox for the last thread with those people, and checks whether that's enough. If it isn't, it goes round again. If it is, it writes the brief.

![Think. Act. Reflect. The agent loop](/img/writing/ignite-ai/loop.jpg)

The analogy we used all afternoon: **an agent is a new hire you have to onboard.** A new hire gets a role, a briefing, logins, house rules and feedback. An agent gets instructions, context, connectors, boundaries and memory. Most people in the room had onboarded a human before. They knew more about building agents than they assumed.

## Then I showed mine

The demos used real systems. I showed Hoovu's dashboard, where an AI CEO reads nine cities of orders, wastage and collections every morning and says what needs attention. I showed the Rhai agent I message on WhatsApp all day. It added a flight to my calendar from a forwarded PDF ticket, and when I asked it to book a meeting, it warned me first that the slot clashed with the Ignite tech track.

Then I showed the job nobody would put on a chief of staff's job description: I message *"make me an NDA for Hoovu Fresh"*, it checks the legal entity name with me, and a few seconds later a signed, dated PDF comes back. That's my point about these agents. The common jobs, like inbox triage, meeting briefs, a morning brief and a weekly review, are where everyone starts. **The uncommon job that's particular to you is what makes yours worth having.**

## Six questions, then 45 minutes of building

That's why there was no template. Everyone answered the six questions they'd answer for a human chief of staff:

1. Where do they meet you?
2. What do they know on day one?
3. When can they reach out, why, and how?
4. What can they touch, and what can't they?
5. How do they speak, and what's off limits?
6. What should be true in a month because they exist?

The last one does the most work. *"I never walk into a meeting unprepared"* is a success criterion. *"Manage my calendar"* is only a task.

Then everyone built theirs. People created a Claude project, uploaded a setup guide from [heyrhai.com/chief-of-staff-workshop](/chief-of-staff-workshop), typed *Start my chief of staff setup*, and answered one question at a time. When a connector didn't work, they skipped it and it went on a to-do list. When someone got stuck, they raised a hand and we came to their table. By the end, people had instructions, context files, skills for their three most important jobs, and draft-only schedules wherever their account allowed.

![Working at the round tables during the build](/img/writing/ignite-ai/tables.jpg)

**Anthropic** gave every builder in the room **$25 in Claude API credits**, so the build could continue after the day: in Claude Code, and as an always-on agent. The path from here is short. Export the project as one file, hand it to Claude Code with the migration guide, host it on **AWS** so it keeps running when your laptop is closed, and, if you want, put it on WhatsApp so you can message it like a person.

## The idea to take home

I ended the session on a point I keep coming back to: **an agent is not a human.** An agent can be awake at 3am, read every email and never forget a follow-up. Only a human can be present in the room, be trusted with what's unsaid, and be held accountable. That old IBM slide still applies: a computer can never be held accountable, so a computer must never make a management decision.

So don't just digitise the job description. Every role exists for an outcome, and the tasks are how you get there. The outcome stays with the person, and most of the tasks can go to agents. The people at those tables were starting to sort their own work that way.

## Hearing from Anthropic

The day closed in the Main Hall. **Irina Ghose**, Managing Director of Anthropic India, gave the *State of AI* talk. Her examples were close to what we'd done that afternoon: sales, finance and marketing teams building their own tools, often with no code, starting from work they already did. After that came a fireside chat on building, scaling and leading, with Tiffany Bloomquist from AWS, Natasha Wallace from Anthropic and Anuj Gupta from WhiteMatter, moderated by Lathika Pai, who founded SonderConnect.

![Irina Ghose, Managing Director of Anthropic India, on stage at Ignite.AI](/img/writing/ignite-ai/irina.jpg)

Rhai's work is built on Claude, so it meant a lot to share a stage with the Anthropic team, in a room of Bengaluru founders who had built their first agent that afternoon.

## The part nobody saw: the conference ran on a dashboard I built

Ignite.AI also ran on software. I built SonderConnect's event backend in the weeks before, and by the day itself it was handling most of the operations:

- **Bookings and payments.** A booking flow with Razorpay checkout. Seats counted only once paid, prices and discount codes checked on the server, GST invoices issued, and a way for attendees to add a GSTIN after booking.
- **A committee workspace.** Built for phones, because the organising committee opened it from a pinned WhatsApp link. It had a run of show for both tracks, a sponsor pipeline, attendee pace against target, workshop checklists, an event-day logistics list with owners, and a decisions log where every change could be undone.
- **An AI project manager.** An agent scoped to the event that the team could message, loop emails into, and assign tasks through. It ran a weekly rhythm of reminders that organisers could edit themselves. Each person had their own list with three buttons: Done, More time, Blocked.
- **The attendee side.** A shareable "I'll be there" badge for LinkedIn, an attendee home page, one page per session opened by a QR code in each room (ask a question, upvote the best ones, rate the session and leave a voice note for the speakers), a shared photo wall, networking bingo, an end-of-day voice review, and a *built* page where people posted what they made in the workshop.

In other words, the event about building with AI was organised by a small committee working with an agent. That was the workshop's point, played out at the scale of a whole conference.

## Thank you

Thanks to Lathika Pai and the SonderConnect team for building the day. Thanks to **Anthropic** for partnering, for the credits, and for Irina's talk, and to **AWS** for sponsoring the day and running the tech track. And thank you to everyone at the Main Hall tables who built a chief of staff with me. I want to see how it's doing in a month.

If you were there, the guides are still at [heyrhai.com/chief-of-staff-workshop](/chief-of-staff-workshop). If you'd like this workshop for your own team, [start a conversation](/talk).
