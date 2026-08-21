# Using a previous task's result in the next one

A workflow runs tasks in order. Often the task you are configuring needs a value
that an earlier task produced — the network a previous step created, the model a
lookup returned, the id a migration handed back. Rather than copying that value
in by hand, you point at it, and the value is filled in when the workflow runs.

This guide covers how to do that on screen.

---

## Before you start

**You can only take a value from a task that runs before the one you are
editing.** A task that runs later has not produced anything yet, so there is
nothing to take. The editor only offers the ones that qualify.

"Before" follows the arrows, not the position on screen:

| Shape | What the last task can use |
| --- | --- |
| `A → B → C` | `C` can use `A` and `B` |
| `A ┐`<br>`B ┘→ C` (two paths joining) | `C` can use **both** `A` and `B` |
| `A → B` and `X → Y` side by side, never joining | `B` can use `A` only. `X` and `Y` are unrelated to it |

---

## Two ways to fill the body

At the top of Task Configuration you choose where the request body comes from.

### Fill in fields (the usual choice)

The property table stays as it is. Each field can be typed in directly, or
filled from a previous task — field by field, mixed freely. Most of the time
this is what you want.

### Take the whole result

The entire body becomes one previous task's result. There are no fields to edit,
because the body is replaced wholesale. Use this when the earlier task returns
exactly the shape this task expects — migration steps often line up this way.

When you choose this, the panel lists **what will actually be passed** so you can
see what the task will send.

> If nothing runs before this task, this option is switched off and the panel
> says so.

---

## What is actually saved

The workflow does not store the value — it stores **where to get it**. Following one value through makes the rest of this guide easier to read.

Say an earlier task named `source` returns this:

```json
{ "id": "example-001",
  "name": "sample-record",
  "payload": { "tag": "demo", "value": 42 } }
```

There are three ways the next task can receive it, and the two choices at the top of the panel decide which one you get.

| What you choose | What is stored | What the task receives |
| --- | --- | --- |
| **Take the whole result** | `source` | the entire response |
| **Take the whole result**, then one value from it | `source.$.payload` | `{"tag":"demo","value":42}` |
| **Fill in fields** | `{"picked":"${source.$.id}"}` | `{"picked":"example-001"}` |

The first two **replace the body outright** — that is why there are no fields left to edit. The third **keeps the body you built** and swaps in a value where you asked for one.

### Why a whole object may not fit a text field

Filling a field is a text substitution: the reference is swapped for the value where it sits. A piece of text drops in cleanly. A whole object does not — it arrives carrying its own quotes, which close the field's quotes early and leave the body malformed. The task then fails when the workflow runs.

That is what the **Type** line is telling you when it says the types do not fit. It does not stop you, because what a task declares and what it really returns can differ — but if you go ahead with an object in a text field, expect the run to fail there.

### The whole result cannot be dropped into one field

`Fill in fields` always takes *one value out of* an earlier task, never the whole of it. To pass the whole result, switch to **Take the whole result** instead — that replaces the body rather than filling a slot in it.

---

## Picking a value

There are three ways in. They do the same thing — use whichever suits you.

### From the field

Each field has a small target button. Press it and the value list opens for that
field.

### From the canvas

Press **Take from a previous task** at the top of the panel, or drag it onto the
canvas. The tasks you are allowed to pick light up and their names appear; the
rest fade. Drop on one — or click it — and its values open.

This is usually the fastest when you know *which task* has the value but not what
it is called.

### From the list

The task selector at the top of the panel holds the same tasks. Use it when
dragging is awkward.

---

## The value list

Every previous task is laid out at once, not one at a time behind a selector.
You often do not know which task produces the value you want, so the search box
runs across all of them.

Each row shows the field, its type, and an example where one is available.

| What you see | What it means |
| --- | --- |
| **Value to be saved** | The reference that will be stored. This is what the workflow keeps |
| **Type** | The type of the value you picked against the type of the field it is going into |
| `Multiple` badge | The path can match more than one item, so a list may arrive |
| **Enter a path directly** | For anything the list does not cover. Folded away until you need it |

### When a task shows no values

Some tasks do not describe what they return — ones assembled by hand, and APIs
whose successful response has no body. The list says so for that task, and you
can enter a path directly instead.

### About the examples

An example is only shown when the task itself provides one. **Where there is no
example the column is left empty on purpose** — filling it with a placeholder
would read as "this is the value you will get", which is not something anyone can
promise before the workflow runs.

---

## Once a field is filled from another task

The field stops being a text box and shows the reference instead:

```
targetInfra.vNetId    ⛓ vnet_create ▸ $.id     ✎ ✕
```

It cannot be typed into. A reference is ordinary text underneath, and one stray
keystroke would break it with nothing on screen to say so — so changing it is
deliberate:

- **✎** opens the value list again, on the same field
- **✕** clears it and gives you an empty box back

Different fields can point at different tasks. Mixing typed values and references
in the same body is normal.

---

## "This workflow has references that will not work"

This appears when you open a workflow that reads a task which does not run
first. The editor cannot produce one of these — it only ever offers tasks that
run before. A definition that came from an import, another tool, or a hand-edited
file can.

Such a workflow **will fail when run**: at that moment there is no result to
take.

The notice lists every one — which task, which field, and what it points at. The
fields themselves are marked in red where they sit. Open each one and pick a
value from a task that runs first.

Saving is not blocked. You may be part way through rewiring, and being unable to
save would leave an imported workflow impossible to work on.

---

## Things worth knowing

**A path that matches nothing fails the task.** The value list shows what a task
*says* it returns, which cannot prove the value will be there in a particular
run. If a path finds nothing at run time, that task fails.

**A whole object dropped into a text field will not fit.** The type line warns
you. It does not stop you — what a task describes and what it really sends can
differ, so the last call is yours.

**A task name cannot contain a dot.** References split the task name from the
path at the first dot, so a dot in the name breaks them.

**Removing an arrow can strip a value of its source.** If you disconnect tasks so
that one no longer runs before another, references between them stop being valid
and are flagged.

---

## Related

- [Running workflow tasks in parallel](workflow-parallel-steps.md)
- [Reading the run status screen](workflow-run-status.md)
