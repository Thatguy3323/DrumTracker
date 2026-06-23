# DrumTracker - Setup Guide

**Audio In. MIDI Out. Perfect Every Time.**

---

## Prerequisites

### System Requirements
- **Windows 10+** (for WPF)
- **.NET 8 SDK** (for backend)
- **.NET Framework 4.8+** or **.NET 6+** (for frontend)
- **Visual Studio 2022** or **VS Code**
- **4GB RAM minimum**, 8GB recommended
- **500MB free disk space**

### Installation

#### 1. Install .NET 8 SDK
```powershell
# Download from https://dotnet.microsoft.com/download
# Or use Chocolatey
choco install dotnet-sdk-8.0

# Verify installation
dotnet --version
```

#### 2. Install Visual Studio 2022 (Recommended)
- Include workload: **Desktop development with C++**
- Include workload: **ASP.NET and web development**
- Components: Windows Presentation Foundation (WPF)

---

## Quick Start

### Clone & Open the Solution

```bash
git clone https://github.com/yourusername/DrumTracker.git
cd DrumTracker

# Open in Visual Studio
start DrumTracker.sln
```

---

## 🖥️ Frontend Setup (WPF)

### Option A: Visual Studio
1. Open `DrumTracker.sln`
2. Set `DrumTracker.UI` as startup project
3. Press `F5` to run

### Option B: Command Line
```bash
cd frontend/DrumTracker.UI

# Restore dependencies
dotnet restore

# Build
dotnet build

# Run
dotnet run
```

**App will launch at:** Local display (no URL)

---

## 🔌 Backend Setup (.NET 8 API)

### Step 1: Configure Database

#### Using SQLite (Development - Default)
No additional setup required. Database creates automatically.

#### Using SQL Server (Production)
```bash
cd backend/DrumTracker.API

# Update connection string in appsettings.json
# Then run migrations
dotnet ef database update
```

### Step 2: Start the API

```bash
cd backend/DrumTracker.API

# Restore packages
dotnet restore

# Apply migrations (if using SQL Server)
dotnet ef database update

# Run the server
dotnet run
```

**API available at:** `http://localhost:5000`

**Swagger UI:** `http://localhost:5000/swagger`

---

## 📋 Project Structure Overview

```
DrumTracker/
├── frontend/              # WPF Desktop Application
│   └── DrumTracker.UI/
│
├── backend/               # .NET 8 WebAPI
│   └── DrumTracker.API/
│
├── shared/                # Shared libraries
│   └── DrumTracker.Common/
│
├── docs/                  # Documentation
└── DrumTracker.sln        # Solution file
```

---

## 🔧 Development Workflow

### Creating a New Feature

1. **Frontend Feature:**
   ```
   Pages/NewFeature/
   ├── NewFeatureView.xaml
   ├── NewFeatureView.xaml.cs
   └── NewFeatureViewModel.cs
   ```

2. **Backend Endpoint:**
   ```
   Controllers/NewFeatureController.cs
   Services/NewFeatureService.cs
   Models/Requests/NewFeatureRequest.cs
   Models/Responses/NewFeatureResponse.cs
   ```

3. **Connect Frontend to Backend:**
   ```csharp
   // In ViewModel
   var result = await _apiService.PostAsync<NewFeatureResponse>(
       "/api/newfeature/process", 
       request
   );
   ```

---

## 🧪 Testing

### Unit Tests
```bash
# Create test project (if not exists)
dotnet new xunit -n DrumTracker.Tests

# Run tests
dotnet test
```

### API Testing
Use **Swagger UI** at `http://localhost:5000/swagger` or **Postman**.

---

## 📦 Build & Deploy

### Build Release
```bash
# Frontend
cd frontend/DrumTracker.UI
dotnet publish -c Release -o ./publish

# Backend
cd backend/DrumTracker.API
dotnet publish -c Release -o ./publish
```

### Deploy Backend to Azure/AWS
See cloud provider documentation.

---

## 🔗 API Integration

### Frontend Calls Backend Example

```csharp
// Models/AudioFile.cs
public class AudioFile
{
    public string FileName { get; set; }
    public string FilePath { get; set; }
    public TimeSpan Duration { get; set; }
}

// Services/IApiService.cs
public interface IApiService
{
    Task<T> PostAsync<T>(string endpoint, object data);
    Task<T> GetAsync<T>(string endpoint);
}

// Services/ApiService.cs
public class ApiService : IApiService
{
    private readonly HttpClient _httpClient;
    private const string BaseUrl = "http://localhost:5000";

    public async Task<T> PostAsync<T>(string endpoint, object data)
    {
        var json = JsonSerializer.Serialize(data);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync($"{BaseUrl}{endpoint}", content);
        
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"API error: {response.StatusCode}");

        var responseJson = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<T>(responseJson);
    }

    public async Task<T> GetAsync<T>(string endpoint)
    {
        var response = await _httpClient.GetAsync($"{BaseUrl}{endpoint}");
        var json = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<T>(json);
    }
}

// ViewModels/AudioProcessingViewModel.cs
public class AudioProcessingViewModel : PageViewModel
{
    private readonly IApiService _apiService;

    public async Task ProcessAudio(AudioFile file)
    {
        try
        {
            var request = new HitDetectionRequest 
            { 
                FilePath = file.FilePath,
                Sensitivity = 0.7f
            };
            
            var result = await _apiService.PostAsync<HitDetectionResponse>(
                "/api/detection/detect", 
                request
            );
            
            // Update UI with results
            DetectionResults = result.Hits;
        }
        catch (Exception ex)
        {
            ErrorMessage = ex.Message;
        }
    }
}
```

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check port 5000 is not in use
netstat -ano | findstr :5000

# Kill process if needed
taskkill /PID <PID> /F

# Try different port in appsettings.json
```

### Database errors
```bash
# Reset database
dotnet ef database drop --force
dotnet ef database update
```

### Frontend won't connect to backend
- Verify backend is running on `http://localhost:5000`
- Check firewall settings
- Verify `ApiService` base URL matches

---

## 📚 Documentation Files

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — System design & structure
- **[API_REFERENCE.md](./API_REFERENCE.md)** — Complete API endpoints
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — Contribution guidelines

---

## 🎯 Next Steps

1. **Read [ARCHITECTURE.md](./ARCHITECTURE.md)** for system overview
2. **Explore [API_REFERENCE.md](./API_REFERENCE.md)** for endpoint details
3. **Check [CONTRIBUTING.md](./CONTRIBUTING.md)** before contributing
4. **Create a feature branch** and start developing!

---

## 📞 Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Contact: [your-email@example.com]
- Documentation: [https://drumtracker-docs.com]

---

**Happy coding! 🎵**
