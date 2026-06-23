---
name: Essentia onset detection quirks
description: Pitfalls when using essentia.standard.Onsets and OnsetDetection in the drum detection pipeline.
---

Essentia's `Onsets` processor expects `frameRate = sampleRate / 512` exactly. Any other hop size triggers a warning and produces zero results. Do NOT use `Onsets` with a variable hop derived from `pre_filter_ms`.

**Why:** The algorithm's internal HMM is trained at that specific frame rate; mismatch silently degrades performance.

**How to apply:** Always use `hopSize=512` for the Essentia frame pipeline. Use `scipy.signal.find_peaks` on the normalised ODF for peak-picking — this gives full control over `height`, `distance`, and `prominence` without the frame-rate constraint.

Also: `Onsets(silenceThreshold=...)` expects a value in [0,1] (linear ratio), NOT in dB.
