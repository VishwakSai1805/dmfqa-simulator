# CPU Scheduling Simulator — Static MLQ vs. MLFQ with Aging

An interactive simulator that runs two CPU scheduling algorithms on the same set of
processes and compares the results.

- **Baseline:** a static Multilevel Queue (MLQ). A process is assigned to a queue when
  it arrives and stays there.
- **DMFQ-A:** a Dynamic Multilevel Feedback Queue with Aging. Every process starts in
  the top queue and moves between queues based on how it behaves.

Built with React, TypeScript, Vite and Tailwind CSS. Charts use Recharts.

## Running it

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run test     # engine tests
npm run build    # production build
```

## The queue structure

Both algorithms use the same three queues:

| Queue | Policy | Time quantum |
|---|---|---|
| Q0 | Round Robin | 4 ms |
| Q1 | Round Robin | 8 ms |
| Q2 | FCFS | none — runs to completion |

Q0 has the highest priority. A process in Q1 or Q2 only runs when all higher queues are
empty, and is preempted immediately if something arrives in a higher queue.

## How the two algorithms differ

**Baseline (static MLQ).** On arrival, a process is placed in a queue based on its
declared burst time:

```
bt <= 4   ->  Q0
bt <= 12  ->  Q1
else      ->  Q2
```

It never moves after that. If it uses up its time quantum without finishing, it goes to
the back of the *same* queue.

This models a system that classifies jobs once, at admission, and never changes its mind.
The rule is needed because without it every process would start in Q0 and the two
algorithms would behave almost identically.

**DMFQ-A.** Every process is admitted to Q0 — the scheduler makes no assumption about a
job it hasn't run yet. Then:

- **Demotion:** if a process uses its entire time quantum without finishing, it is moved
  down one queue. A job that keeps needing the full quantum is probably CPU-bound, so it
  belongs lower down. Q2 is the bottom.
- **Aging:** if a process has waited 16 ms continuously in Q1 or Q2 without getting the
  CPU, it is promoted up one queue. This is what stops low-priority jobs being ignored
  forever.

## Metrics

| Metric | Formula |
|---|---|
| Completion Time (CT) | clock time when the process finishes |
| Turnaround Time (TAT) | `CT − AT` |
| Waiting Time (WT) | `TAT − BT` |
| Response Time (RT) | `first time it ran − AT` |

Also tracked:

- **Context switches** — counted when the process on the CPU changes from one tick to the
  next, and both are real processes. Going idle doesn't count, because nothing is saved
  or restored against an idle CPU.
- **CPU utilisation** — busy ticks / total ticks.
- **Starvation incidents** — the number of processes that ever waited 16 ms or more
  continuously without reaching the CPU.

## How the code is organised

```
src/engine/         the simulation — plain TypeScript, no React
  types.ts            data types and constants (quanta, aging threshold)
  core.ts             the tick loop (this is the main file)
  baselineScheduler.ts
  dmfqaScheduler.ts
  metrics.ts          averages and totals
  __tests__/          tests for the engine
src/hooks/useScheduler.ts   playback control
src/components/     the UI pieces
src/data/presets.ts the three built-in workloads
```

The simulation runs in 1 ms steps. Each step does five things in this order: handle
arrivals, update waiting times and apply aging, pick which process runs, run it for 1 ms,
then handle completion or demotion. A snapshot of the whole system is saved after every
step.

Both algorithms call the same tick loop and differ only through three settings: which
queue a process is admitted to, whether aging is on, and where a process goes when its
quantum runs out. Keeping the loop shared means any difference in the results comes from
the algorithm and not from a bug in one of two separate implementations.

The entire timeline is calculated up front, before playback starts. Playback just moves
an index through the saved snapshots, which is why stepping backwards and dragging the
slider work.

## Presets

1. **Standard Benchmark** — P1(0,8) P2(1,4) P3(2,9) P4(3,5). Small enough to check by hand.
2. **Demotion Cascade** — P1(0,20) P2(2,2) P3(4,3). P1 walks Q0 → Q1 → Q2 while the short
   jobs finish ahead of it.
3. **Starvation Showcase** — P1(0,24) plus 4 ms jobs arriving at T = 2, 5, 8, 11, 14, 17,
   20, 23. A steady stream of arrivals is needed here: a few short jobs would drain away
   and nothing would starve. 4 ms of work arriving every 3 ms keeps Q0 permanently busy.

There is also a Custom option for entering your own processes (up to 15, arrival 0–500,
burst 1–100, whole numbers only).

## Results

These are the numbers the simulator produces. `npm run test` regenerates them, and the
app prints the same table to the browser console when it loads.

| Preset | Algorithm | Avg TAT | Avg WT | Avg RT | Switches | Starvation | Worst wait |
|---|---|---|---|---|---|---|---|
| Standard Benchmark | Baseline | 15.50 | 9.00 | 6.75 | 5 | 1 | 17 |
| Standard Benchmark | DMFQ-A | 18.25 | 11.75 | 4.50 | 6 | 0 | 12 |
| Demotion Cascade | Baseline | 10.00 | 1.67 | 0.00 | 3 | 0 | 4 |
| Demotion Cascade | DMFQ-A | 11.33 | 3.00 | 1.33 | 3 | 0 | 5 |
| Starvation Showcase | Baseline | 12.89 | 6.67 | 3.11 | 9 | 1 | 31 |
| Starvation Showcase | DMFQ-A | 15.56 | 9.33 | 5.78 | 10 | 1 | 24 |

### What the numbers show

DMFQ-A does **not** win on everything, and the simulator reports what it actually computes
rather than what the algorithm is supposed to do.

- **Average turnaround is worse under DMFQ-A on all three presets.** Demotion pushes long
  jobs down before aging can bring them back up, and on small workloads there isn't enough
  time for that to pay off.
- **It uses more context switches**, which is expected — more movement between queues means
  more preemption.
- **It wins on response time and starvation where the baseline guesses wrong.** On the
  Standard Benchmark, P4 (burst 5) is put in Q1 behind two longer jobs and waits 17 ms
  without running. DMFQ-A brings average response time from 6.75 ms down to 4.50 ms and
  removes the starvation case.
- **It loses on response time where the baseline guesses right.** On the other two presets
  every job's burst time maps to the correct queue, so the baseline effectively gets the
  right answer for free while DMFQ-A has to discover it by running each job first.
- **On the Starvation Showcase, aging reduces the problem without fixing it.** P1's worst
  continuous wait drops from 31 ms to 24 ms, but both algorithms still register one starved
  process. Work arrives faster than the CPU can clear it for the whole run, so Q0 refills
  faster than a promoted process can be served. Aging is a fairness mechanism — it can't
  create CPU time that doesn't exist.

## Assumptions and limitations

- One CPU core.
- Processes are purely CPU-bound — there are no I/O bursts.
- Context switches are counted but take zero time, so DMFQ-A's extra switches don't cost it
  anything in turnaround. Charging a real cost per switch would make its results worse.
- Burst times are known when a process arrives, which the baseline uses for classification.
  Real operating systems can't know this.
- Three fixed workloads, not a random sample, so the results illustrate the behaviour rather
  than prove it statistically.
