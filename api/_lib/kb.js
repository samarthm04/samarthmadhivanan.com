/* Knowledge base — the ONLY source of facts the assistant may use.
   Derived from samarthm04's public GitHub repos and the site's own copy.
   Keep it factual. Anything not written here, the assistant must not claim. */

export const KB = `
## WHO

Samarth Madhivanan. AI/ML Analyst at KPMG Digital Lighthouse, Mumbai.
He builds agentic AI systems and workflow automation.
Studied Electronics & Communication Engineering (ECE) at MIT Manipal.
Based in Mumbai, works on IST.
Takes freelance work alongside the full-time role — a couple of projects at a time.
Usually replies within 24 hours.

Contact: samarthm04edu@gmail.com
GitHub: https://github.com/samarthm04
LinkedIn: https://www.linkedin.com/in/samarth-madhivanan2306
Site: https://www.samarthmadhivanan.com

## WHAT HE WORKS ON

1. Agentic AI Systems
2. Workflow Automation
3. Data Tools
4. Interfaces & Frontend Experience

His framing: find the unglamorous, manual parts of how a business runs, and design AI
systems that automate them safely and reliably.

## GOOD FIT FOR

- Something repetitive — a weekly report, the same five copy-pastes, the thing one person always ends up doing.
- An online presence that looks like you: a site, a portfolio, a product page.
- A task you'd like to hand to AI but aren't sure how — sorting, summarising, drafting, extracting, deciding.
- Data scattered across PDFs, inboxes and spreadsheets that should be one clean table.
- A rough idea built properly enough to show people.

## HANDY TO KNOW

- Small projects are welcome. A bot or a one-page tool is a perfectly good project.
- You don't need a spec to start. "This is annoying" is enough.
- Sometimes the answer is a spreadsheet formula, not AI. He will say so if that's the case.
- He works IST alongside a full-time role, so he takes on a couple of projects at a time.

## PROJECTS (all public on GitHub)

Agent Interface Layer — flagship, open source.
Give an LLM a URL and a goal in plain language; it drives a real browser and answers,
never seeing raw HTML. Perception falls back accessibility tree -> DOM -> vision. A safety
layer hands off before it ever touches a password field. Python, Playwright, MCP, CDP.
https://github.com/samarthm04/agent-interface-layer

DataWrangler — KPMG Digital Lighthouse.
An AI data-cleaning workbench for financial analysts. Eight transforms, automatic type
detection, and an LLM that proposes a fix you approve before it runs. Raw cell values never
leave the browser — only a schema summary goes to the model. JavaScript, FastAPI, Pandas, Claude.
https://github.com/samarthm04/datawrangler

IndyCare MedAI — IndyRX, oncology.
Turns a consultation and a stack of medical reports into structured, guideline-driven
clinical documentation. Python, LLM, Clinical NLP.
https://github.com/samarthm04/indycare-medai-mvp

Financial Logging Bot — freelance, shipped.
A Telegram bot that turns messy expense chatter and photographed cheques into structured
transactions. The client stopped keeping a spreadsheet; their CA gets clean books
automatically. Python, OCR, LLM, Telegram.
https://github.com/samarthm04/finance_bot

Zais DJ Engine — side project.
An AI DJ that hears structure: beat, key and cycle analysis, automatic cue-point detection,
then renders a continuous beatmatched set. Python, DSP, Audio ML.
https://github.com/samarthm04/zais-dj

Support Triage RL — OpenEnv Hackathon.
A real-world RL environment that grades whether an agent can run a support inbox: escalate
the outage, answer the routine ticket, spot the spam, across progressive difficulty tiers.
Python, RL, OpenEnv.
https://github.com/samarthm04/openenv-support-triage

Vehicle Cut-In Detection — Intel, research.
YOLOv8 tracking that infers where the road actually is (road, sky and mid lines) so it adapts
to any camera angle, then computes time-to-collision and warns on cut-ins. Python, YOLOv8, OpenCV.
https://github.com/samarthm04/Vehicle_Cut-In_Detection

Audit Workpaper Assistant — KPMG, proof of concept.
Reads audit workpapers the way a reviewer does and surfaces what needs a human.
Python, LLM, Document AI.
https://github.com/samarthm04/audit-poc-final

Capital Statement — KPMG, internal tooling.
Structured extraction and generation for statement preparation that used to run on copy-paste.
Python, automation.
https://github.com/samarthm04/capital-statement_kpmg

Advanced Lane Detection — computer vision.
Perspective transform, colour and gradient thresholding, curvature fitting for lane finding
on real driving footage. Python, OpenCV.
https://github.com/samarthm04/advanced-lane-detection-for-self-driving-cars

CV Zero to Hero — open source guide.
A step-by-step route from no machine learning to being genuinely useful at computer vision.
Notebooks, teaching.
https://github.com/samarthm04/ComputerVision_0_to_Hero

Home Scouter — product experiment.
House hunting as a data problem: gathering and structuring listings so the shortlist comes
out of evidence instead of endless tabs. Web, data.
https://github.com/samarthm04/home-scouter

Knackify — product, in progress.
An early-stage product build. Repo is public, story still being written. Web.
https://github.com/samarthm04/knackify

Also public, smaller: real-estate-property-portal, scalerhackk, movie_booking-2,
naisha_portfolio, toe-bc03-poc, health-companion-ai, alpha-fleet-insight, breathe-global-trends.
Full list: https://github.com/samarthm04?tab=repositories

## SITE PAGES

Home: /  |  Projects: /projects.html  |  Blog: /blog.html  |  Contact: /contact.html
`.trim();
