# Demo Guide

How to start the project, what to show, and the facts worth having in your head.
The algorithm itself is explained in `README.md` — this file is the runbook.

---

## 1. Starting it

Open a terminal in the project folder (`C:\Claude\OS Project`) and run:

```bash
npm run dev
```

It prints a URL — usually `http://localhost:5173`. Open that in a browser.

`node_modules` is already installed. If it ever goes missing, run `npm install` once
first. Leave the terminal open while you demo; closing it stops the server.

To run the tests (separate terminal, or stop the server with `Ctrl+C` first):

```bash
npm run test
```

Expected: **53 tests passed, 3 test files**.

---

## 2. The screen

| Area | What it shows |
|---|---|
| Top bar | Preset buttons · engine toggle (Baseline / DMFQ-A) |
| Transport | Play / pause / step / reset · speed · timeline slider |
| Queues | CPU, Q0, Q1, Q2, Done — processes move between lanes as time advances |
| Timeline | Gantt chart. Solid strip = selected engine, faded strip = the other one |
| Metrics | Both algorithms side by side, `▸` marks the better figure |
| Averages | Bar chart + starvation and context-switch counts |
| Processes | Per-process AT, BT, CT, TAT, WT, RT and worst wait |
| Event log | Every arrival, dispatch, demotion, promotion and exit, with timestamps |

Keyboard: `Space` play/pause, `←` `→` step one tick.

---

## 3. Demo run — about 6 minutes

### Standard Benchmark, DMFQ-A (2 min)

Default view when the page loads. Press **Play**.

- All four processes enter **Q0** — DMFQ-A assumes nothing about a job it hasn't run.
- Pause around **T=3**. P1 has used its full 4 ms quantum and drops to Q1. The event log
  reads `DEMOTION: P1 demoted Q0 → Q1`.
- Three demotions happen in total: P1 at T=3, P3 at T=11, P4 at T=15.
- Point at the metrics table: DMFQ-A wins response time (4.50 vs 6.75) and starvation
  (0 vs 1), loses turnaround (18.25 vs 15.50).

### Same preset, switch to Baseline (1 min)

Click **Baseline** in the top-right toggle. Same processes, different algorithm.

- P4 has burst 5, so the static rule puts it in **Q1** behind two longer jobs. It waits
  **17 ms** without running — the red figure in the Processes table.
- That misclassification is the whole point of the comparison. The baseline decides once
  and never revises.
- The only preemption in this preset is at **T=1**, when P2 arrives in Q0 and pushes P1
  (in Q1) off the CPU.

### Demotion Cascade (1 min)

Click the preset. Keep DMFQ-A selected. Play.

- P1 has burst 20 and walks all the way down: **Q0 → Q1 at T=3**, **Q1 → Q2 at T=16**.
- The two short jobs finish ahead of it even though they arrived later.

### Starvation Showcase (2 min)

Click the preset, DMFQ-A, play — or drag the slider straight to **T=19**.

- **This is the only preset where aging fires.** At T=19 the log shows
  `AGING TRIGGER: P1 promoted Q1 → Q0`.
- Full story for P1: demoted at T=3, aged back up at T=19, demoted again at T=31,
  demoted to Q2 at T=47.
- Switch to Baseline and compare worst wait: **31 ms** baseline vs **24 ms** DMFQ-A.
  Aging reduced the wait but both still report one starved process.
- This is the most interesting result in the project. Say it plainly: work arrives faster
  than the CPU can clear it for the entire run, so Q0 refills faster than a promoted
  process can be served. **Aging is a fairness mechanism, not a capacity one — it cannot
  create CPU time that doesn't exist.**

### Custom (30 sec, optional)

Click **Custom**. Add a process, type a decimal or a negative number to show the
validation, then **Run**. Limits: 15 processes, arrival 0–500, burst 1–100, integers only.

---

## 4. Quick facts

**Queues** — both algorithms use the same three:

| Queue | Policy | Quantum |
|---|---|---|
| Q0 | Round Robin | 4 ms |
| Q1 | Round Robin | 8 ms |
| Q2 | FCFS | none, runs to completion |

Priority is strict: Q0 > Q1 > Q2.

**Baseline admission** (fixed at arrival, never revised):
`bt ≤ 4 → Q0`, `bt ≤ 12 → Q1`, `else → Q2`

**DMFQ-A:** everything enters Q0. Quantum used up without finishing → down one tier.
16 ms continuous wait → up one tier.

**Formulas:** `TAT = CT − AT` · `WT = TAT − BT` · `RT = first run − AT`

**Counting rules:**
- Context switch — CPU occupant changes between two ticks *and both are real processes*.
  Idle transitions don't count.
- Starvation incident — counted per *process*, not per event. One incident for any
  process that ever waited 16 ms continuously without reaching the CPU.
- Preemption — only from a strictly higher queue. A same-queue arrival never preempts.

---

## 5. Results (what the simulator actually computes)

| Preset | Algorithm | Avg TAT | Avg WT | Avg RT | Switches | Starvation | Worst wait |
|---|---|---|---|---|---|---|---|
| Standard Benchmark | Baseline | 15.50 | 9.00 | 6.75 | 5 | 1 | 17 |
| Standard Benchmark | DMFQ-A | 18.25 | 11.75 | **4.50** | 6 | **0** | **12** |
| Demotion Cascade | Baseline | 10.00 | 1.67 | 0.00 | 3 | 0 | 4 |
| Demotion Cascade | DMFQ-A | 11.33 | 3.00 | 1.33 | 3 | 0 | 5 |
| Starvation Showcase | Baseline | 12.89 | 6.67 | 3.11 | 9 | 1 | 31 |
| Starvation Showcase | DMFQ-A | 15.56 | 9.33 | 5.78 | 10 | 1 | **24** |

CPU utilisation is 100% and makespan is identical for both algorithms on all three
presets — same total work, no idle time, so scheduling order can't change either.

---

## 6. Things that only happen in one place

Worth knowing before someone asks you to "show me X".

| Event | Where it actually happens |
|---|---|
| **Aging** | Starvation Showcase only, **once**, at T=19. Never fires on the other two presets — no process waits long enough. |
| **Demotion** | DMFQ-A only. The baseline never demotes anything. |
| **Preemption** | Baseline only — once per preset, when the first short job arrives. |
| **Quantum re-queue** | Baseline, Standard Benchmark, T=19 (P3 back to the tail of Q1). |

The preemption one is the likely follow-up question. The answer: under DMFQ-A every
process is admitted to Q0, and preemption only fires from a *strictly higher* queue —
so while everything sits in Q0 there is no higher queue to preempt from. Preemption
appears under DMFQ-A only once a process has been demoted and something new arrives
above it, which none of these three workloads produce.

---

## 7. If something goes wrong

| Problem | Fix |
|---|---|
| `npm` not recognised | Node isn't installed or isn't on PATH. Check with `node -v`. |
| Port 5173 busy | Vite picks the next free port — read the URL it prints. |
| Blank page | Check the terminal for a compile error; the browser console (F12) shows it too. |
| Page looks cramped | Designed for 1180×740 and up. Zoom out with `Ctrl` + `-`. |

Have the browser open and the preset loaded **before** you start presenting. Starting the
dev server in front of the room wastes a minute and risks a surprise.
