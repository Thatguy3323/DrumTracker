# DrumTracker - Full-Stack Architecture

**Audio In. MIDI Out. Perfect Every Time.**

---

## 🏗️ System Overview

DrumTracker is a comprehensive desktop application for professional drum production:

- **AI-Powered Hit Detection**: Automatically detects drum hits in audio files
- **Drum Kit Generation**: Creates custom drum kits from text prompts using AI
- **Drum Replacement**: Replaces acoustic drums with programmed sounds
- **MIDI Export**: Exports detected hits as MIDI files for DAW integration
- **Waveform Preview**: Real-time audio visualization and analysis

---

## 📋 Architecture Layers

### Frontend: WPF Desktop Application
- **Framework**: Windows Presentation Foundation (.NET Framework/Core)
- **Pattern**: MVVM (Model-View-ViewModel)
- **Styling**: Resource-based theming with TailwindCSS-inspired approach
- **Navigation**: Custom navigation service for page routing

### Backend: .NET 8 WebAPI
- **Framework**: ASP.NET Core 8
- **Pattern**: Microservices architecture with isolated engines
- **Database**: Entity Framework Core with SQL Server/SQLite
- **Audio Processing**: NAudio + custom DSP algorithms

---

## 📂 Complete Project Structure

```
DrumTracker/
│
├── frontend/
│   └── DrumTracker.UI/
│       ├── App.xaml                          # Application entry point
│       ├── App.xaml.cs
│       ├── MainWindow.xaml                   # Main application window
│       ├── MainWindow.xaml.cs
│       │
│       ├── Resources/
│       │   ├── Colors.xaml                   # Color palette definitions
│       │   ├── Styles.xaml                   # Global XAML styles
│       │   ├── Brushes.xaml                  # Brush resources
│       │   └── Icons.xaml                    # Icon resources
│       │
│       ├── Shell/
│       │   ├── ShellView.xaml                # Main shell layout
│       │   ├── ShellView.xaml.cs
│       │   ├── ShellViewModel.cs             # Shell state management
│       │   ├── Sidebar.xaml                  # Left navigation panel
│       │   ├── Sidebar.xaml.cs
│       │   ├── Topbar.xaml                   # Top toolbar
│       │   ├── Topbar.xaml.cs
│       │   └── PageKey.cs                    # Page enumeration
│       │
│       ├── Navigation/
│       │   ├── INavigationService.cs         # Navigation interface
│       │   ├── NavigationService.cs          # Navigation implementation
│       │   └── PageViewModel.cs              # Base page view model
│       │
│       ├── Pages/
│       │   ├── Home/
│       │   │   ├── HomeView.xaml
│       │   │   ├── HomeView.xaml.cs
│       │   │   └── HomeViewModel.cs
│       │   │
│       │   ├── AudioProcessing/
│       │   │   ├── AudioProcessingView.xaml
│       │   │   ├── AudioProcessingView.xaml.cs
│       │   │   └── AudioProcessingViewModel.cs
│       │   │
│       │   ├── HitDetection/
│       │   │   ├── HitDetectionView.xaml
│       │   │   ├── HitDetectionView.xaml.cs
│       │   │   └── HitDetectionViewModel.cs
│       │   │
│       │   ├── AIKits/
│       │   │   ├── AIKitsView.xaml
│       │   │   ├── AIKitsView.xaml.cs
│       │   │   └── AIKitsViewModel.cs
│       │   │
│       │   ├── DrumReplacement/
│       │   │   ├── DrumReplacementView.xaml
│       │   │   ├── DrumReplacementView.xaml.cs
│       │   │   └── DrumReplacementViewModel.cs
│       │   │
│       │   ├── Waveform/
│       │   │   ├── WaveformPageView.xaml
│       │   │   ├── WaveformPageView.xaml.cs
│       │   │   ├── WaveformPageViewModel.cs
│       │   │   ├── WaveformControl.xaml
│       │   │   └── WaveformControl.xaml.cs
│       │   │
│       │   ├── MIDIExport/
│       │   │   ├── MIDIExportView.xaml
│       │   │   ├── MIDIExportView.xaml.cs
│       │   │   └── MIDIExportViewModel.cs
│       │   │
│       │   └── Settings/
│       │       ├── SettingsWindow.xaml
│       │       ├── SettingsWindow.xaml.cs
│       │       └── SettingsViewModel.cs
│       │
│       ├── Controls/
│       │   ├── AudioUploadControl.xaml
│       │   ├── AudioUploadControl.xaml.cs
│       │   ├── DrumKitPreview.xaml
│       │   ├── DrumKitPreview.xaml.cs
│       │   ├── HitDetectionGrid.xaml
│       │   ├── HitDetectionGrid.xaml.cs
│       │   ├── MIDIExportPanel.xaml
│       │   └── MIDIExportPanel.xaml.cs
│       │
│       ├── Services/
│       │   ├── IApiService.cs                # API communication interface
│       │   ├── ApiService.cs                 # REST API client
│       │   ├── AudioFileService.cs           # Local audio file handling
│       │   └── ProjectService.cs             # Project management
│       │
│       ├── Models/
│       │   ├── AudioFile.cs
│       │   ├── DrumKit.cs
│       │   ├── HitDetectionResult.cs
│       │   ├── MIDIExportSettings.cs
│       │   └── Project.cs
│       │
│       ├── Utils/
│       │   ├── RelayCommand.cs               # ICommand implementation
│       │   ├── ViewModelBase.cs              # Base view model
│       │   ├── Constants.cs                  # Application constants
│       │   ├── Extensions.cs                 # Extension methods
│       │   └── Converters.cs                 # XAML value converters
│       │
│       ├── DrumTracker.UI.csproj
│       └── app.config
│
├── backend/
│   └── DrumTracker.API/
│       ├── Program.cs                        # Application startup
│       ├── appsettings.json
│       ├── appsettings.Development.json
│       ├── DrumTracker.API.csproj
│       │
│       ├── Controllers/
│       │   ├── AudioController.cs
│       │   ├── HitDetectionController.cs
│       │   ├── AIKitController.cs
│       │   ├── DrumReplacementController.cs
│       │   ├── WaveformController.cs
│       │   └── MIDIExportController.cs
│       │
│       ├── Services/
│       │   ├── AudioEngine.cs                # Audio loading & PCM extraction
│       │   ├── HitDetectionEngine.cs         # Transient detection
│       │   ├── AIKitLLMService.cs            # AI kit generation
│       │   ├── AiKitMixService.cs            # Mix rules (EQ, compression)
│       │   ├── MIDIExportService.cs          # MIDI file generation
│       │   ├── WaveformPreviewEngine.cs      # Waveform rendering
│       │   └── IEngineBase.cs                # Base engine interface
│       │
│       ├── Models/
│       │   ├── Requests/
│       │   │   ├── AudioUploadRequest.cs
│       │   │   ├── HitDetectionRequest.cs
│       │   │   ├── AIKitGenerationRequest.cs
│       │   │   ├── DrumReplacementRequest.cs
│       │   │   ├── MIDIExportRequest.cs
│       │   │   └── WaveformRequest.cs
│       │   │
│       │   ├── Responses/
│       │   │   ├── AudioUploadResponse.cs
│       │   │   ├── HitDetectionResponse.cs
│       │   │   ├── AIKitResponse.cs
│       │   │   ├── DrumReplacementResponse.cs
│       │   │   ├── MIDIExportResponse.cs
│       │   │   └── WaveformResponse.cs
│       │   │
│       │   └── Domain/
│       │       ├── AudioFile.cs
│       │       ├── HitMap.cs
│       │       ├── DrumKit.cs
│       │       ├── DrumKitSound.cs
│       │       └── MIDINote.cs
│       │
│       ├── Data/
│       │   ├── DrumTrackerDbContext.cs       # EF Core context
│       │   ├── Migrations/
│       │   └── Repositories/
│       │       └── IRepository.cs
│       │
│       ├── Utils/
│       │   ├── AudioDSP.cs                   # DSP algorithms
│       │   ├── MIDIUtilities.cs              # MIDI helpers
│       │   └── Constants.cs
│       │
│       └── Middleware/
│           ├── ErrorHandlingMiddleware.cs
│           └── LoggingMiddleware.cs
│
├── shared/
│   ├── DrumTracker.Common/
│   │   ├── Models/
│   │   │   ├── AudioMetadata.cs
│   │   │   ├── ProcessingStatus.cs
│   │   │   └── Enums.cs
│   │   │
│   │   ├── Interfaces/
│   │   │   ├── IAudioProcessor.cs
│   │   │   └── IMIDIExporter.cs
│   │   │
│   │   └── Utils/
│   │       └── Validators.cs
│   │
│   └── DrumTracker.Common.csproj
│
├── docs/
│   ├── ARCHITECTURE.md                       # This file
│   ├── SETUP.md                              # Setup instructions
│   ├── API_REFERENCE.md                      # API endpoints
│   ├── CONTRIBUTING.md                       # Contribution guidelines
│   └── diagrams/
│       ├── system-architecture.md
│       ├── data-flow.md
│       └── ui-wireframes.md
│
├── DrumTracker.sln                           # Visual Studio solution file
├── README.md                                 # Project overview
├── LICENSE
└── .gitignore
```

---

## 🔌 API Endpoints

### Audio Processing
- `POST /api/audio/upload` — Upload audio file
- `GET /api/audio/{id}` — Retrieve audio metadata
- `DELETE /api/audio/{id}` — Delete audio file

### Hit Detection
- `POST /api/detection/detect` — Detect drum hits
- `GET /api/detection/{id}/results` — Get detection results
- `PATCH /api/detection/{id}/settings` — Update detection settings

### AI Kit Generation
- `POST /api/kits/generate` — Generate kit from text prompt
- `GET /api/kits/{id}` — Retrieve kit details
- `PUT /api/kits/{id}` — Update kit parameters

### Drum Replacement
- `POST /api/replacement/process` — Process drum replacement
- `GET /api/replacement/{id}/status` — Check processing status

### MIDI Export
- `POST /api/midi/export` — Export hits as MIDI
- `GET /api/midi/{id}` — Download MIDI file

### Waveform Preview
- `POST /api/waveform/preview` — Generate waveform image
- `GET /api/waveform/{id}/audio` — Get preview audio

---

## 🔧 Technology Stack

### Frontend (WPF)
- **.NET Framework 4.8 / .NET 6+**
- **Windows Presentation Foundation (XAML)**
- **MVVM Pattern**
- **RestSharp** or **HttpClient** for API communication
- **NAudio** for local audio playback

### Backend (.NET 8)
- **ASP.NET Core 8**
- **Entity Framework Core**
- **Serilog** (logging)
- **NAudio** (audio processing)
- **Melanchall.DryWetMidi** (MIDI handling)
- **OpenAI/Anthropic API** (AI kit generation)

### Database
- **SQL Server** (production)
- **SQLite** (development)

---

## 🚀 Quick Start

### Frontend Setup
```bash
cd frontend/DrumTracker.UI
# Open DrumTracker.UI.csproj in Visual Studio
# Or build from command line:
dotnet build
dotnet run
```

### Backend Setup
```bash
cd backend/DrumTracker.API
dotnet restore
dotnet ef database update
dotnet run
```

Backend runs on: `http://localhost:5000`

---

## 🔄 Data Flow

1. **User uploads audio** → WPF UI sends to backend
2. **Audio Engine loads file** → Extracts PCM data
3. **Hit Detection** → Identifies transients and classifies drums
4. **User applies settings** → Adjusts sensitivity, threshold, etc.
5. **Export to MIDI** → Converts hit map to MIDI file
6. **Download/Preview** → User previews or exports MIDI

---

## 📝 Naming Convention

All namespaces, classes, and identifiers use **DrumTracker** (no spaces):
- Namespace: `DrumTracker.UI`, `DrumTracker.API`, `DrumTracker.Common`
- Class: `DrumTrackerDbContext`, `AudioEngine`
- Files: All PascalCase with no underscores

---

## 🎯 Key Design Principles

1. **Modularity**: Each engine is independent and replaceable
2. **Separation of Concerns**: Frontend-Backend communication via REST API
3. **Scalability**: Microservice-ready architecture
4. **Testability**: Service-based design enables unit testing
5. **User Experience**: Responsive UI with real-time feedback
