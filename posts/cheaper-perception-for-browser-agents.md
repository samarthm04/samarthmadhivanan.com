---
title: Cheaper perception for browser agents
date: 2026-09-08
excerpt: Giving an LLM the accessibility tree instead of raw HTML cut token cost by roughly 4x — and it made the agent more reliable, not less.
tags: [agents, browser, tokens]
---

Most "LLM drives a browser" demos feed the model raw HTML or a screenshot. Both are expensive. Raw DOM is enormous and full of noise the model has to wade through; vision tokens add up fast and the model still has to guess at what is clickable.

While building [Agent Interface Layer](https://github.com/samarthm04/agent-interface-layer) I measured what each perception mode actually costs per step.

## The numbers

- **Accessibility tree** — the cheapest useful representation. Roles, names and states, nothing else. About a quarter of the tokens of the equivalent DOM.
- **Filtered DOM** — needed when the a11y tree is missing something. Still a lot of tokens.
- **Vision** — most expensive, and only pulled in when the first two disagree or come up empty.

## Why cheaper was also better

The accessibility tree is not just smaller, it is closer to the decision the agent has to make. It already answers "what can I interact with and what is it called?" The model spends its budget choosing an action instead of parsing markup.

> Perception falls back a11y tree → DOM → vision, and the agent only pays for the expensive modes when it needs them.

The safety layer sits on top of all three: before any action touches a credential field, the agent hands control back rather than typing.

## Takeaway

If you are building an agent that operates a UI, start from the accessibility tree and treat DOM and vision as fallbacks you pay for on demand. The default of "dump the whole page in" is the expensive path and usually the less reliable one.
