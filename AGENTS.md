# Wizard of Wor — Agent System

This project uses a two-tier agent system:

1. **Automated agents** — runnable scripts that test the live system (CI/CD ready)
2. **AI prompt agents** — codebase-aware prompts for AI-assisted development in each domain

---

## Automated Agents

Run with `npm run agent:<name>` or `bash scripts/agents/run-agent.sh <name>`.

| Agent | Command | What it checks |
|-------|---------|----------------|
| `quality` | `npm run agent:quality` | API lint + integration tests + community-web build |
| `smoke` | `npm run agent:smoke` | HTTP health checks across all 4 surfaces |
| `performance` | `npm run agent:performance` | WebSocket throughput (40 connections, 20 pairs) |
| `ux` | `npm run agent:ux` | Route availability + landmark structure on community web |
| `design` | `npm run agent:design` | Visual consistency (card density, hero section) |
| `ops` | `npm run agent:ops` | systemd services + public domain health probes |
| `gameplay` | `npm run agent:gameplay` | Bot seeding coverage across all 4 BR modes |
| `netcode` | `npm run agent:netcode` | WebSocket handshake latency + HTTP endpoint health |
| `analytics` | `npm run agent:analytics` | Live snapshot report: mode distribution, bot/human ratio |
| `release` | `npm run agent:release` | Full composite pipeline (all of the above) |

### Environment Variables

```bash
# gameplay agent
GAMEPLAY_CHECK_BASE_URL=https://wizardofwor.duckdns.org

# netcode agent (point at multiplayer container port)
NETCODE_CHECK_HTTP_BASE=http://127.0.0.1:42735
NETCODE_CHECK_WS_URL=ws://127.0.0.1:42735/multiplayer
NETCODE_LATENCY_THRESHOLD_MS=500

# analytics agent
ANALYTICS_CHECK_BASE_URL=https://wizardofwor.duckdns.org

# ux / design agents
UX_AGENT_WEB_PORT=48611
DESIGN_AGENT_WEB_PORT=48611
```

---

## AI Prompt Agents

Each prompt file in `scripts/agents/prompts/` is a codebase-aware context document.
Open the relevant file and paste its content into any AI assistant (GitHub Copilot Chat,
Claude, ChatGPT) to get a specialist agent focused on that domain.

```bash
cat scripts/agents/prompts/01-game-systems.md
```

| # | Agent | File | Focus |
|---|-------|------|-------|
| 1 | 🎮 Game Systems Architect | `01-game-systems.md` | Win conditions, balancing, session design |
| 2 | 🕹️ Retro Gameplay Feel | `02-retro-feel.md` | Movement physics, input latency, enemy AI |
| 3 | 🧩 Multiplayer / Netcode | `03-netcode.md` | WebSocket sync, reconnect, anti-cheat |
| 4 | ⚡ Performance Optimization | `04-performance.md` | FPS, bundle size, server tick efficiency |
| 5 | 🧠 UX / Interface Design | `05-ux-design.md` | Lobby, HUD, spectator, post-death flow |
| 6 | 🌐 Community Architect | `06-community-architect.md` | Profiles, match history, replay, clans |
| 7 | 🧱 Frontend Engineering | `07-frontend-engineering.md` | React/Next.js components, real-time UI |
| 8 | 🧲 Growth Hacker | `08-growth-hacker.md` | Viral loops, referrals, community launch |
| 9 | 💬 Community Engagement | `09-community-engagement.md` | Events, Discord, challenges, dev logs |
| 10 | 📊 Data + Analytics | `10-analytics.md` | Retention metrics, event schema, funnels |
| 11 | 🎯 Monetization Strategy | `11-monetization.md` | Cosmetics, battle pass, supporter perks |
| 12 | 🧪 Experimentation | `12-experimentation.md` | A/B tests, feature flags, tuning |

### How to Use a Prompt Agent

1. Open the prompt file: `cat scripts/agents/prompts/05-ux-design.md`
2. Paste into your AI assistant of choice
3. Follow the **Example Invocations** at the bottom of each file
4. Iterate — the prompts provide codebase context so the AI gives precise, file-specific answers

### Quick Reference — Which Agent for What?

| Task | Agent |
|------|-------|
| "Bot AI feels too random" | `02-retro-feel` + `01-game-systems` |
| "Player disconnected mid-game" | `03-netcode` |
| "Game feels laggy" | `04-performance` + `03-netcode` |
| "Lobby is confusing" | `05-ux-design` |
| "Add match history" | `06-community-architect` + `07-frontend-engineering` |
| "Build a new component" | `07-frontend-engineering` |
| "How do we get first players?" | `08-growth-hacker` |
| "Plan a weekly event" | `09-community-engagement` |
| "What's our retention?" | `10-analytics` |
| "Add cosmetic skins" | `11-monetization` + `07-frontend-engineering` |
| "Test shorter countdown" | `12-experimentation` |

---

## Adding a New Agent

1. Create `scripts/agents/prompts/<n>-<name>.md` following the existing template
2. If automatable, add `scripts/agents/<name>-check.mjs`
3. Add a `run_<name>_agent()` function in `run-agent.sh`
4. Add a `case` entry in `run-agent.sh`
5. Add `"agent:<name>": "bash scripts/agents/run-agent.sh <name>"` to `package.json`
6. Update this file
