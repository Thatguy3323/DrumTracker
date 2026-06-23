---
name: Persisting torch / native audio deps via uv on Replit
description: How to install torch (CPU), openunmix, and essentia so they survive reconciliation, and how to get uv to resolve them.
---

# Installing torch / openunmix / essentia so they PERSIST

## The persistence trap (most important)
`pip install ...` packages live in `.pythonlibs` but are NOT in `pyproject.toml` /
`uv.lock`. After a task merges, the platform runs reconciliation (`uv sync`) which
**prunes everything not in the lock**. So pip-installed `torch`, `openunmix`,
`essentia` silently vanish on the next merge and the engine quietly falls back
(HPSS-only + librosa onsets) instead of the real 2-stage pipeline.

**Rule:** anything the engine needs at runtime MUST be a uv dependency in
`pyproject.toml` and present in `uv.lock`. Verify after any merge with
`python3 -c "import torch, openunmix, essentia"`.

## CPU torch, not CUDA
Plain `pip install torch` pulls the full CUDA build (~2GB of nvidia-* wheels) and
can hit a disk quota that `df` doesn't show. `pyproject.toml` defines an explicit
`pytorch-cpu` index and routes `torch*` / `torchaudio` to it via `[tool.uv.sources]`,
so uv pulls torch ~190MB CPU wheels (`torch==2.x+cpu`). Keep that routing.

## Getting uv to actually resolve (the gotchas)
1. **Do NOT route non-torch packages to the pytorch-cpu index.** That index is
   `explicit = true`, so uv looks ONLY there for routed names. `openunmix` is NOT
   hosted there → "no versions of openunmix for linux". It must resolve from PyPI.
2. **The `installLanguagePackages` wrapper auto-re-adds `openunmix` (any
   torch-dependent pkg) to the pytorch-cpu sources list**, which re-breaks
   resolution every time. So for these packages, edit `pyproject.toml` by hand and
   run **raw `uv lock` then `uv sync`** (bypasses the wrapper). uv installs into
   `UV_PROJECT_ENVIRONMENT=.pythonlibs`, the same place the workflow's python uses.
3. **essentia ships ONLY a `cp311` manylinux-x86_64 wheel** (e.g.
   `essentia-2.1b6.dev1389-cp311...`) and is pre-release only. So:
   - pin `requires-python = ">=3.11,<3.12"` (3.12 split has no essentia wheel),
   - add `[tool.uv]` `environments = ["sys_platform == 'linux'"]` (non-linux splits
     have no essentia/torch-cpu wheel),
   - spec it with a pre-release lower bound, e.g. `"essentia>=2.1b6.dev1389"`,
     or uv won't pick a pre-release.
   Without these, uv's universal resolver fails on the 3.12 / macOS / windows
   splits even though we only run linux+3.11.

## Open-Unmix weights
umxhq pretrained weights (drums target ~34MB) download once to
`.cache/torch/hub/checkpoints/` then load in <1s. First-ever separation call is
slow (download); budget a long timeout or pre-warm. The model is loaded as a
cached singleton and offloaded via `asyncio.to_thread` so it doesn't block the loop.
