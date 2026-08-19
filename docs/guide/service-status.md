# Checking that the linked services are answering

cm-butterfly does not do the migration itself. It asks the linked services — cb-tumblebug, cb-spider, cm-beetle, cm-honeybee, cm-grasshopper, cm-cicada, cm-damselfly, cm-ant — and shows what they answer.

So when one of them stops answering, the console has nothing to show. Until this screen existed, that looked exactly like having nothing to show: an empty list either way, with no way to tell which it was without asking someone.

---

## 1. The screen

**System > Service Status**, at the bottom of the left menu.

Each service takes two rows. The first carries the name, the state and the version; the second carries the address of the specification those operations came from. They are split because putting the address on the same row pushed the state across the screen and wrapped the name.

| Column | What it says |
|---|---|
| Service | The name the console calls it by, which is the name used in the operation path |
| Status | **Healthy**, **Not answering**, or **Unknown** |
| Version | The tag the operations were generated from, as recorded in `api.yaml` |
| Specification | Where that specification was read from |

**Recheck** asks again immediately, rather than waiting for the next round.

## 2. Why the version is on this screen

An empty screen has two causes that look the same, and the version separates them.

- **The service is not answering.** Status says so.
- **The service answers, but the console is asking for something it no longer has.** Status is Healthy and the version is behind the running image.

The second is the one that used to cost an afternoon. A screen would come up blank, the service was plainly running, and nothing on screen connected the two. The version and the specification address are here so both are visible next to the status rather than found by reading configuration files.

> The version is what `api.yaml` records, not what the container reports. `0.6.0(latest)` means the operations were generated from the `v0.6.0` tag and the specification called itself `latest`.

## 3. You are told wherever you are

The check runs in the console's layout, not on this screen, so it keeps running whichever screen you are on.

- A failure raises a **dialog**. It does not close by itself — a failure that happened while nobody was looking is still there when they come back.
- Acknowledging it leaves **one line at the top**, which goes by itself once everything answers again.
- The line comes back if a service fails again.

This matters because the screens where a failure actually hurts are the ones where you are doing the migration, not this one.

## 4. When something is not answering

The state is what the service reported, so start from what the row says.

| What you see | What to do |
|---|---|
| One service Not answering | That container is down or still starting. Bring it up and press Recheck |
| Several at once | Usually the host or the network rather than the services. Check the stack is up |
| Healthy but a screen is still empty | Compare the version with the image the lineup runs. If they disagree, the specification is behind |
| Unknown | The check has not completed a round yet. Press Recheck |

Running the whole stack with cm-mayfly:

```bash
./mayfly infra info      # what is running, and its state
./mayfly infra run -d    # bring up what is not
```

## 5. Changing how often it checks

Both settings come from the environment, so they can be changed without a new image.

| Variable | What it sets |
|---|---|
| `HEALTH_CHECK_INTERVAL_SEC` | Seconds between rounds |
| `HEALTH_CHECK_FAILURE_THRESHOLD` | How many failures in a row before a service is called Not answering |

The threshold exists so a single slow reply does not raise a dialog. Lower it to be told sooner; raise it if a service on a busy host reports failures it recovers from on its own.
