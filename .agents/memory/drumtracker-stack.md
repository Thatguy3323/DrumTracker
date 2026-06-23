---
name: DrumTracker stack
description: Architecture decisions for the DrumTracker full-stack web app built from C# reference files.
---

## Stack

- **Frontend**: React 18 + Vite 5 + TypeScript in `frontend/`, served on port 5000 in dev (`--host 0.0.0.0`). Proxies `/api` to `localhost:8080`.
- **Backend**: Python FastAPI + uvicorn in `backend/`, runs on `127.0.0.1:8080` in dev.
- **DSP**: `librosa` for real onset detection (`onset.onset_detect`) + spectral classification (FFT frequency bands for kick/snare/hihat/tom). `midiutil` for MIDI generation.
- **Dev workflow command**: `(cd backend && python3 -m uvicorn main:app --host 127.0.0.1 --port 8080) & (cd frontend && npm run dev)`
- **Production**: Build step `cd frontend && npm install && npm run build`, run step `cd backend && python3 -m uvicorn main:app --host 0.0.0.0 --port 5000`. Backend serves built React via FastAPI StaticFiles + SPA fallback (only when `frontend/dist` exists).

**Why:** The C# WPF reference files couldn't run in Replit, so the app was reimplemented as a web stack with Python doing the actual DSP work librosa was doing what NAudio would have done.

**How to apply:** If extending — add new API routes in `backend/main.py`, new pages in `frontend/src/pages/`, and register them in `frontend/src/App.tsx` ROUTES array.
