# Finding your way with the Migration Guide

A migration in this console is five steps across four screens, and the screens do not say which one comes first. Someone opening it for the first time can see every menu and still not know where to start.

The **Migration Guide** answers that. It shows the five steps, marks the ones already done, and points at the one to do next.

---

## 1. The five steps

| # | Step | Where it happens |
|---|---|---|
| 1 | **Register Source Service** | Source Services |
| 2 | **Collect** | Source Services |
| 3 | **Create Source Model** | Source Services |
| 4 | **Create Target Model** | Source Models |
| 5 | **Create and Run Workflow** | Target Models |

Two things about this list are worth saying out loud, because they are the parts people get wrong.

- **Collecting is its own step.** It is not part of making a source model. A source model is built *from* what was collected, so a model made before collecting is a model of nothing.
- **Creating a workflow and running it are one step.** They happen on the same screen and finishing one without the other leaves nothing to show for it.

Each step names **what is left of it**, not the whole of it. A step that is half done and named by the whole leaves you looking for work that is already finished.

## 2. Where it opens

The guide opens on **the step that matches the screen you are looking at**, rather than always at the top. Coming to it from Source Models opens step 4.

You can walk the whole list from there — a completed step still shows what it produced, which is the fastest way to check whether something was actually made.

## 3. Your position is worked out, not remembered

The console does not keep a checklist. It reads the data and works out where you are.

Register a source service, and step 1 is finished the moment that data exists. Nothing has to be marked. Sign out, sign back in on another machine, and the answer is the same, because it was never stored anywhere to go stale.

The reading is refreshed when the step moves, so a step completed on the screen you are on is reflected without a reload.

> This is also why a step can go *back*. Delete the only source service and step 1 is unfinished again — which is correct, and is what you would want to be told.

## 4. Next-action banners

The guide screen is not the only place this shows up. **Source Services**, **Source Models**, **Target Models** and **Workflows** each carry a banner naming what to do next on that screen.

The banner appears only on the step you are actually on. On a screen whose step is finished there is nothing to say, so nothing is said.

An empty screen carries the same hint rather than being blank — an empty list because nothing has been made yet reads very differently from an empty list because something failed.

## 5. First entry, and turning it off

On first entry the console **opens on the guide** with a short welcome dialog.

- Both buttons on the welcome dismiss it **for good**. It is shown once, not once per session.
- Guidance can be **turned off** in the settings, and **reopened** from there later.
- Turning it off hides the welcome and the banners. The guide screen itself stays reachable from the menu.

The welcome is deliberately once-only: something that reappears every time you sign in stops being read after the second time.

## 6. Two constraints worth reading before you start

Both cost a failed attempt if they are skipped, so they are marked in the help panel where they apply rather than left in prose.

- **Which collection to run depends on what you are migrating.** Collecting the wrong thing produces a source model that cannot become the target you want. The help on the Source Services screen goes through each one.
- **A server that cannot be reached cannot be collected from.** Check the connection status first — see [Checking that source servers can be reached](source-connection-status.md).

## 7. Going deeper

Some steps have a written guide behind them, reachable from the step itself.

| Step | Guide |
|---|---|
| Register Source Service | [Bulk Import of Source Connections](source-connection-bulk-import.md) |
| Create and Run Workflow | [Reading the Run Status Screen](workflow-run-status.md) |

The guides ship with the source, so they move with the version they describe and cannot drift into a stale copy hosted somewhere else.

For the whole path end to end, see [Quick Start: Running a Migration](quick-start-migration.md).
