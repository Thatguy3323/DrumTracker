---
name: CPU-only torch install on Replit
description: How to install PyTorch / torch-dependent packages (openunmix, etc.) without exhausting the disk quota.
---

# Installing torch / torch-based packages in this environment

Plain `pip install torch` (or any package that depends on it, e.g. `openunmix`)
resolves to the **full CUDA build**: torch ~532MB plus 2GB+ of NVIDIA CUDA wheels
(cudnn, nccl, cufft, triton, cusparselt, nvshmem, ...). This blows the per-user
disk quota and fails with `OSError: [Errno 122] Disk quota exceeded` even though
the overlay filesystem looks mostly empty (the quota is separate from `df`).

**Rule:** always install the CPU-only build first, then the dependent package:

```
pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch torchaudio
pip install --no-cache-dir openunmix   # reuses the already-installed CPU torch
```

CPU torch is ~192MB and pulls no `nvidia-*` wheels.

**Why:** the project does CPU inference only; the CUDA stack is dead weight and
exceeds the quota.

**How to apply:**
- If a `pip install` dies with "Disk quota exceeded" while downloading torch/CUDA,
  run `pip cache purge` to reclaim space, then redo with the CPU index URL above.
- uv path: `pyproject.toml` already defines a `pytorch-cpu` explicit index and
  routes `torch*` to it via `[tool.uv.sources]`. Do NOT add a non-torch package
  (like `openunmix`) to that sources list — `explicit = true` makes uv look ONLY
  on that index, where openunmix doesn't exist, so resolution fails. Let such
  packages resolve from PyPI and only their `torch` dep routes to the CPU index.
- uv also needs `requires-python` upper-bounded (e.g. `>=3.11,<3.13`) or it tries
  to resolve openunmix for 3.13+, which has no wheel, and fails.
- Open-Unmix pretrained weights (umxhq drums) download once to
  `.cache/torch/hub/checkpoints/` (~34MB for the drums target) then load in <1s.
  First-ever call is slow (download); budget a long timeout or pre-warm it.
