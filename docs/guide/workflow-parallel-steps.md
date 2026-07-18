# Running Workflow Tasks in Parallel

By default, the tasks in a workflow run one after another. When two tasks do not
depend on each other, you can place them side by side so they run at the same
time and the workflow finishes sooner.

This guide covers how to build such a workflow in the Workflow Tool, and what
the shapes on the canvas mean when the workflow actually runs.

---

## What the canvas means

The picture is not decoration. **The way you arrange the boxes is exactly what
determines the run order.**

| On the canvas | When it runs |
|---------------|--------------|
| Items stacked top to bottom | Each one starts only after the one above it finishes |
| Branches inside a **Parallel** step | They all start at the same moment and run together |
| Whatever comes after a **Parallel** step | It waits for **every** branch to finish |
| A **TaskGroup** box | A label for tidiness. It does not change the run order |

---

## Adding a parallel step

1. Open the workflow in the Workflow Tool.
2. Drag **Parallel** from the palette on the left onto the canvas, at the point
   where the work should split.
3. Drop a task into the box. This is the first branch.
4. Drop another task **to its left or right**. This is the second branch.

Each task you add to the side becomes another branch, so the number of branches
you see is the number of tasks that will run at the same time.

> **Left and right only work inside a Parallel step.** Everywhere else on the
> canvas you can only drop above or below, because everywhere else is a
> sequence. If you want two things to run together, they have to be inside a
> Parallel step.

### Leave no branch behind

A Parallel step with a single branch is the same as a plain straight line — one
task cannot run in parallel with nothing. If you save while a Parallel step
still has one branch, the tool tells you which step it was so you can go back
and finish it.

---

## Making the branches come back together

Put the next task **below the Parallel step**, not inside it. The Parallel step
already draws the split at its top and the merge at its bottom, so whatever you
place underneath is the point where the branches meet.

```
        A                1. Place A
        │                2. Place a Parallel step below A
   ┌────┴────┐           3. Put B and C side by side inside it
   B         C           4. Place D below the Parallel step
   └────┬────┘
        │                B and C run together.
        D                D starts only after both have finished.
```

A common mistake is to look for a place to put D *inside* the box. There isn't
one, and there doesn't need to be — the merge is the step that follows.

---

## Branches of different lengths

Branches do not have to be the same size. Drop a **TaskGroup** box into one side
of the Parallel step and stack several tasks inside it, and that branch will run
them in order while the other branch runs its own work.

```
        A
   ┌────┴────┐
   B         E           B then C on the left,
   │                     E alone on the right.
   C
   └────┬────┘           D waits for C and E.
        D
```

You can also place another Parallel step inside a branch when the work splits
again. There is no limit to how deeply you can nest.

A branch may also simply end instead of rejoining. If nothing follows the
Parallel step, each branch just finishes on its own.

---

## Checking what will actually run

Open **Run Status** for the workflow. The diagram there is drawn from the saved
run order rather than from the boxes, so it shows exactly what the engine will
do. If it matches what you drew, the workflow is set up the way you intended.

---

## When the tool opens the JSON editor instead

Some run orders cannot be drawn with nested boxes. The clearest example is a
task that both joins a merge and, separately, starts work that skips that merge.
A box sends its outgoing line from a single point at the bottom, so there is no
way to draw a line leaving from the middle of a branch.

When you open such a workflow, the tool does not try to straighten it out.
Drawing it as something else would show you a run order that is not the real
one, and saving it would quietly change how the workflow runs. Instead the tool
explains why and offers the JSON editor, where the run order is written out
directly.

Run Status still displays these workflows correctly — the restriction applies to
editing on the canvas, not to viewing.

---

## Things worth knowing

- **Task names must be unique within a workflow.** They are how one task refers
  to another, so a duplicate name breaks that reference. The tool numbers new
  tasks for you (`task`, `task2`, `task3`) and reports duplicates before saving.
- **Names are never changed when you open a workflow.** What you saved is what
  you see.
- **Box positions are not stored** — only the run order is. Reopening a
  workflow gives you the same structure, though a parallel step's branches may
  be laid out left to right in a different order. The workflow runs the same
  either way.
- **An empty box is skipped.** It does not interrupt the flow: whatever follows
  still waits for whatever came before the empty box.
