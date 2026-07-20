# Testing Instructions

Everything a judge needs to run and evaluate RememberKin.

## Demo accounts

All demo accounts use the password: **`RememberKin2026!`**

| Email | Member | Role |
|-------|--------|------|
| `demo@rememberkin.demo` | Linh Nguyen | Family owner |
| `judge1@rememberkin.demo` | Uncle Tuan | Family member |
| `judge2@rememberkin.demo` | Aunt Mai | Family member |
| `judge3@rememberkin.demo` | Cousin Duc | Family member |

> The login page also has one-click **Demo account** cards — no typing needed.

## How to access

**Option A — Live demo:** `<paste deployed URL here>`

**Option B — Run locally:**
```bash
git clone https://github.com/minkhant1996/RememberKin-QWEN.git
cd RememberKin-QWEN
docker compose up -d --build
# Frontend: http://localhost:6101   ·   Backend: http://localhost:6100
```
The demo family data ("The Nguyen Family") is pre-seeded.

## Suggested 60-second test — the MemoryAgent core

This shows persistent, cross-session, cross-member memory (the Track 1 requirement):

1. Log in as **Linh Nguyen** (`demo@rememberkin.demo`).
2. Go to **Chat** and send:
   > "Grandma Hoa's birthday is August 22nd, and her pho secret is charring the ginger just right."
3. Open the **Memory** dashboard → see the new fact in the **Working** layer → click **Consolidate Now** → it moves to **Semantic** (long-term memory).
4. **Log out.** Log back in as **Uncle Tuan** (`judge1@rememberkin.demo`).
5. In **Chat**, ask:
   > "When is my mother's birthday?"
   → It recalls **August 22nd**, fusing profile + stored memory. Proof of persistent, cross-session, cross-member recall.

## Also worth trying

- **Photo memory:** in Chat, ask *"Where did An and Duc go together?"* → the answer names the Old Quarter of Hanoi and the real tagged family photo appears inline.
- **Self-evaluation:** open **Simulation** → **Run** the "Family Memory Recall" scenario → watch it score itself (memory recall, context relevance, entity extraction).
- **Cost transparency:** the live spend readout in the chat footer meters every Qwen call.

## Notes

- The demo password above is intentionally shared — these are throwaway demo accounts with fictional data.
- All AI runs on Alibaba Cloud Model Studio (DashScope) — see [`backend/src/config/qwen.ts`](../backend/src/config/qwen.ts) and [`s.yaml`](../s.yaml).
