# DrumTracker

**Audio In. MIDI Out. Perfect Every Time.**

DrumTracker is a professional-grade desktop application for drum production that combines AI-powered hit detection, automated drum replacement, and MIDI export—all in one integrated system.

---

## ✨ Features

### 🎯 Hit Detection
- Automatic drum hit detection with transient analysis
- Real-time classification (kick, snare, tom, hi-hat)
- Adjustable sensitivity and threshold parameters
- Visual grid mapping of detected hits

### 🤖 AI Drum Kits
- Generate custom drum kits from natural language prompts
- LLM-powered kit creation and sound design
- Pre-built drum kit library with multiple styles
- Mix settings: EQ, compression, saturation

### 🥁 Drum Replacement
- Replace acoustic drums with programmed sounds
- Seamless integration with detected hit maps
- Customizable mixing and processing
- Real-time preview of replacements

### 🎵 MIDI Export
- Export detected hits as professional MIDI files
- Standard MIDI format compatible with all DAWs
- Customizable tempo, time signature, and velocity curves
- Direct integration with music production workflows

### 📊 Waveform Visualization
- Real-time audio waveform rendering
- Zoom and pan controls
- Visual hit detection feedback
- Playback with synchronized timeline

---

## 🚀 Quick Start

### Prerequisites
- Windows 10 or later
- .NET 8 SDK
- Visual Studio 2022 (recommended)

### 1-Minute Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/DrumTracker.git
cd DrumTracker

# Open solution
start DrumTracker.sln
```

### Launch Frontend (WPF)
- Set `DrumTracker.UI` as startup project
- Press `F5`

### Launch Backend (API)
```bash
cd backend/DrumTracker.API
dotnet run
# API runs at http://localhost:5000
```

---

## 📚 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — System design, folder structure, technology stack
- **[SETUP.md](./SETUP.md)** — Detailed setup instructions for frontend and backend
- **[API_REFERENCE.md](./API_REFERENCE.md)** — Complete REST API endpoints and usage examples
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — Contribution guidelines

---

## 🏗️ Architecture

### Frontend: WPF Desktop Application
- **MVVM Pattern** for clean separation of concerns
- **Modular Pages** for each major feature
- **Reusable Controls** for common UI elements
- **Real-time Visualization** using custom rendering

### Backend: .NET 8 WebAPI
- **Microservices Architecture** with isolated engines
- **Audio Processing** via NAudio and custom DSP
- **Hit Detection** using advanced signal processing
- **AI Integration** for kit generation and recommendations

### Communication
- RESTful API with JSON request/response
- Async/await for responsive UI
- File streaming for audio and MIDI

---

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  WPF Desktop Application                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Audio Upload │  │Hit Detection │  │ MIDI Export  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  AI Kits     │  │ Drum Replace │  │ Waveform    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────┬──────────────────────────────────────┘
                      │ REST API (HTTP)
┌─────────────────────▼──────────────────────────────────────┐
│              .NET 8 WebAPI Backend                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ AudioEngine  │  │HitDetection  │  │ MIDIExport   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │AIKitLLMSvc   │  │AiKitMixSvc   │  │Waveform      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────┬──────────────────────────────────────┘
                      │ Entity Framework Core
┌─────────────────────▼──────────────────────────────────────┐
│         SQL Server / SQLite Database                         │
│  [Audio Files] [Hit Maps] [Kits] [Projects] [History]      │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔧 Technology Stack

### Frontend
- **Windows Presentation Foundation (XAML)**
- **.NET Framework 4.8 / .NET 6+**
- **MVVM Pattern**
- **RestSharp** for API calls
- **NAudio** for local audio playback

### Backend
- **ASP.NET Core 8**
- **Entity Framework Core**
- **NAudio** for audio processing
- **Melanchall.DryWetMidi** for MIDI handling
- **Serilog** for structured logging
- **OpenAI/Anthropic API** for AI kit generation

### Database
- **SQL Server** (production)
- **SQLite** (development)

---

## 📁 Project Structure

```
DrumTracker/
├── frontend/DrumTracker.UI/          # WPF Desktop App
├── backend/DrumTracker.API/          # .NET 8 WebAPI
├── shared/DrumTracker.Common/        # Shared libraries
├── docs/                             # Documentation
└── DrumTracker.sln                   # Visual Studio Solution
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete folder breakdown.

---

## 🎯 Key Features By Module

### Audio Processing
- Load WAV/MP3 files
- Extract PCM data
- Real-time waveform analysis
- Playback with timeline sync

### Hit Detection
- Transient detection algorithm
- Multi-class drum classification
- Confidence scoring
- Velocity curve generation

### AI Kit Generation
- Natural language prompts
- LLM-powered synthesis
- Mix rule application
- Sound preview and customization

### Drum Replacement
- Hit-based sample replacement
- Volume envelope matching
- Pan and spatial processing
- Real-time audio preview

### MIDI Export
- Standard MIDI format (GM)
- Customizable note mapping
- Tempo and time signature
- Velocity preservation

---

## 🚦 API Workflow Example

```
1. User uploads audio file
   POST /api/audio/upload

2. System detects drum hits
   POST /api/detection/detect

3. User requests MIDI export
   POST /api/midi/export

4. Frontend downloads MIDI
   GET /api/midi/{midiId}/download

5. User imports into DAW
   [DAW imports MIDI for further editing]
```

See [API_REFERENCE.md](./API_REFERENCE.md) for complete endpoint documentation.

---

## 🛠️ Development Commands

```bash
# Build
dotnet build

# Run tests
dotnet test

# Frontend
cd frontend/DrumTracker.UI
dotnet run

# Backend
cd backend/DrumTracker.API
dotnet run

# Backend with migrations
dotnet ef database update
```

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Getting Started with Development

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the architecture patterns

3. **Test thoroughly**
   ```bash
   dotnet test
   ```

4. **Submit a pull request** with clear description

---

## 📋 Roadmap

### v1.0 (Current)
- ✅ Core hit detection
- ✅ Basic drum replacement
- ✅ MIDI export
- ✅ Waveform visualization

### v1.1 (Planned)
- Multi-track support
- Advanced mix assistant
- Batch processing
- Plugin architecture

### v2.0 (Future)
- Cloud kit storage
- VST plugin
- Collaborative workflows
- Real-time streaming

---

## 📜 License

Licensed under the MIT License. See [LICENSE](./LICENSE) file.

---

## 💬 Support & Community

- **Issues**: [GitHub Issues](https://github.com/yourusername/DrumTracker/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/DrumTracker/discussions)
- **Email**: support@drumtracker.dev
- **Documentation**: [https://drumtracker-docs.dev](https://drumtracker-docs.dev)

---

## 🎵 Credits

Built with ❤️ by the DrumTracker team.

**Audio In. MIDI Out. Perfect Every Time.**
