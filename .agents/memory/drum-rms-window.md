---
name: Drum detection RMS threshold window
description: Why the RMS measurement window for drum onset threshold must be ≤20ms.
---

When validating detected onsets against a dBFS threshold, use a **20ms window** (not 50ms) measured from the onset time forward.

**Why:** Drum transients decay in <20ms. A 50ms window averages the transient with the silent tail, halving the effective RMS and causing borderline hits to fall below threshold — false negatives. 20ms captures almost all the attack energy with minimal silence dilution.

**How to apply:** `sample_end = sample_start + int(0.020 * sr)` in `detect_hits`. dBFS threshold conversion: `threshold_linear = 10 ** (threshold_db / 20.0)`.
