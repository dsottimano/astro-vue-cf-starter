# How publishing works

[← Back to wiki](index.md)

**Read this once and a lot of things will make sense.**

## Your changes are not instant — and that's by design

When you save a listing, post, or any change, the website does **not** update
right away. Here's what actually happens:

1. You click **Save** (or confirm in the Telegram bot).
2. Your change is recorded safely (as a versioned "commit").
3. That automatically kicks off a **rebuild** of the website.
4. A minute or two later, the rebuild finishes and the **live site updates**.

So the normal experience is: *save → wait ~1–2 minutes → refresh the public page →
your change is there.*

## Why it's built this way

- **Speed for visitors.** The public site is pre-built, so it loads extremely fast
  and never goes down under traffic.
- **Safety.** Every change is versioned. Mistakes can be undone, and nothing can
  corrupt a live database (there isn't one).

## What this means for you

- ✅ **Don't panic if a change isn't visible immediately.** Give it a couple of
  minutes, then refresh.
- ✅ **Photos are the exception** — uploaded images are available right away (they
  don't wait for a rebuild). But the listing/post that *shows* the photo still
  needs the rebuild to appear.
- ✅ **You can keep working.** Save several changes; they'll all go out with the
  next rebuild.
- ❌ **Don't save the same thing over and over** thinking it didn't work — each
  save triggers another rebuild. Save once, wait, then check.

## "I waited and it still isn't showing"

1. Make sure you actually saw a green **"Saved"** confirmation (not a red error).
2. Hard-refresh the public page (Ctrl/Cmd + Shift + R) to bypass your browser cache.
3. If it's a brand-new listing, check you saved it in the right **language**.
4. Still nothing after ~5 minutes? Tell whoever maintains the site — a build may
   have failed.
