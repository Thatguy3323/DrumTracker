# DrumTracker - REST API Reference

Base URL: `http://localhost:5000/api`

---

## 📁 Audio Endpoints

### Upload Audio File
```http
POST /api/audio/upload
Content-Type: multipart/form-data

Body:
{
  "file": <binary>,
  "projectId": "string"
}

Response: 201 Created
{
  "id": "audio-001",
  "fileName": "drum_loop.wav",
  "duration": "00:01:30",
  "sampleRate": 44100,
  "channels": 2,
  "uploadedAt": "2026-06-18T10:30:00Z"
}
```

### Get Audio Metadata
```http
GET /api/audio/{audioId}

Response: 200 OK
{
  "id": "audio-001",
  "fileName": "drum_loop.wav",
  "duration": "00:01:30",
  "sampleRate": 44100,
  "channels": 2,
  "fileSize": 5242880,
  "status": "ready"
}
```

### List Audio Files
```http
GET /api/audio?projectId=string&page=1&pageSize=20

Response: 200 OK
{
  "data": [
    {
      "id": "audio-001",
      "fileName": "drum_loop.wav",
      "duration": "00:01:30"
    }
  ],
  "totalCount": 42,
  "page": 1,
  "pageSize": 20
}
```

### Delete Audio File
```http
DELETE /api/audio/{audioId}

Response: 204 No Content
```

---

## 🎯 Hit Detection Endpoints

### Detect Drum Hits
```http
POST /api/detection/detect
Content-Type: application/json

Body:
{
  "audioId": "audio-001",
  "sensitivity": 0.7,
  "threshold": -18,
  "preFilter": 15,
  "classificationMode": "default"
}

Response: 200 OK
{
  "detectionId": "detect-001",
  "audioId": "audio-001",
  "totalHits": 128,
  "hitsByType": {
    "kick": 32,
    "snare": 32,
    "hiHat": 64,
    "tom": 0
  },
  "confidence": 0.92,
  "processingTime": 3.5,
  "hits": [
    {
      "timestamp": 0.125,
      "drumType": "kick",
      "velocity": 100,
      "confidence": 0.98
    },
    {
      "timestamp": 0.375,
      "drumType": "snare",
      "velocity": 85,
      "confidence": 0.92
    }
  ]
}
```

### Get Detection Results
```http
GET /api/detection/{detectionId}

Response: 200 OK
{
  "detectionId": "detect-001",
  "audioId": "audio-001",
  "status": "completed",
  "totalHits": 128,
  "hitsByType": { ... },
  "hits": [ ... ]
}
```

### Update Detection Settings
```http
PATCH /api/detection/{detectionId}/settings
Content-Type: application/json

Body:
{
  "sensitivity": 0.8,
  "threshold": -15,
  "preFilter": 20
}

Response: 200 OK
{
  "detectionId": "detect-001",
  "updatedAt": "2026-06-18T10:35:00Z"
}
```

### Get Detection Settings
```http
GET /api/detection/{detectionId}/settings

Response: 200 OK
{
  "sensitivity": 0.7,
  "threshold": -18,
  "preFilter": 15,
  "classificationMode": "default"
}
```

---

## 🎨 AI Kit Generation Endpoints

### Generate Drum Kit from Prompt
```http
POST /api/kits/generate
Content-Type: application/json

Body:
{
  "prompt": "Modern hip-hop kit with 808 kicks and crisp snares",
  "style": "hiphop",
  "numberOfKits": 3
}

Response: 200 OK
{
  "kitId": "kit-001",
  "prompt": "Modern hip-hop kit with 808 kicks and crisp snares",
  "generatedKits": [
    {
      "id": "kit-001-v1",
      "name": "808 Crispness",
      "sounds": {
        "kick": {
          "frequency": 60,
          "sustain": 0.2,
          "reverb": 0.1
        },
        "snare": {
          "frequency": 200,
          "sustain": 0.15,
          "reverb": 0.05
        }
      }
    }
  ]
}
```

### Get Kit Details
```http
GET /api/kits/{kitId}

Response: 200 OK
{
  "id": "kit-001",
  "name": "808 Crispness",
  "createdAt": "2026-06-18T10:30:00Z",
  "sounds": {
    "kick": { ... },
    "snare": { ... },
    "hiHat": { ... }
  }
}
```

### List Available Kits
```http
GET /api/kits?page=1&pageSize=20

Response: 200 OK
{
  "data": [
    {
      "id": "kit-001",
      "name": "808 Crispness",
      "category": "hiphop"
    }
  ],
  "totalCount": 150,
  "page": 1,
  "pageSize": 20
}
```

### Update Kit Parameters
```http
PUT /api/kits/{kitId}
Content-Type: application/json

Body:
{
  "sounds": {
    "kick": {
      "frequency": 65,
      "sustain": 0.25
    }
  }
}

Response: 200 OK
{
  "id": "kit-001",
  "updatedAt": "2026-06-18T10:35:00Z"
}
```

---

## 🥁 Drum Replacement Endpoints

### Process Drum Replacement
```http
POST /api/replacement/process
Content-Type: application/json

Body:
{
  "audioId": "audio-001",
  "detectionId": "detect-001",
  "kitId": "kit-001",
  "outputFormat": "wav"
}

Response: 202 Accepted
{
  "jobId": "replace-001",
  "status": "processing",
  "progress": 0,
  "estimatedTime": 15
}
```

### Get Replacement Status
```http
GET /api/replacement/{jobId}/status

Response: 200 OK
{
  "jobId": "replace-001",
  "status": "completed",
  "progress": 100,
  "outputAudioId": "audio-replaced-001",
  "completedAt": "2026-06-18T10:40:00Z"
}
```

### Download Replaced Audio
```http
GET /api/replacement/{jobId}/download

Response: 200 OK
Content-Type: audio/wav
[binary audio data]
```

---

## 🎵 MIDI Export Endpoints

### Export Hits as MIDI
```http
POST /api/midi/export
Content-Type: application/json

Body:
{
  "detectionId": "detect-001",
  "format": "midi",
  "ticksPerBeat": 480,
  "tempo": 120
}

Response: 200 OK
{
  "midiId": "midi-001",
  "fileName": "drums_export.mid",
  "status": "ready",
  "downloadUrl": "/api/midi/midi-001/download",
  "createdAt": "2026-06-18T10:35:00Z"
}
```

### Download MIDI File
```http
GET /api/midi/{midiId}/download

Response: 200 OK
Content-Type: audio/midi
[binary MIDI data]
```

### Get MIDI Details
```http
GET /api/midi/{midiId}

Response: 200 OK
{
  "midiId": "midi-001",
  "fileName": "drums_export.mid",
  "totalNotes": 128,
  "tempo": 120,
  "timeSignature": "4/4",
  "channels": [
    {
      "channel": 10,
      "instrument": "Drums",
      "noteCount": 128
    }
  ]
}
```

---

## 📊 Waveform Preview Endpoints

### Generate Waveform Image
```http
POST /api/waveform/preview
Content-Type: application/json

Body:
{
  "audioId": "audio-001",
  "width": 1200,
  "height": 300,
  "colorScheme": "neon"
}

Response: 200 OK
{
  "waveformId": "wf-001",
  "imageUrl": "/api/waveform/wf-001/image",
  "duration": "00:01:30",
  "generatedAt": "2026-06-18T10:35:00Z"
}
```

### Get Waveform Image
```http
GET /api/waveform/{waveformId}/image

Response: 200 OK
Content-Type: image/png
[binary image data]
```

### Get Preview Audio
```http
GET /api/waveform/{waveformId}/audio?start=0.5&end=2.0

Response: 200 OK
Content-Type: audio/wav
[binary audio data]
```

---

## ❌ Error Responses

All endpoints return standard error responses:

```json
{
  "error": "BadRequest",
  "message": "Invalid audio file format",
  "statusCode": 400,
  "timestamp": "2026-06-18T10:30:00Z"
}
```

### Common Status Codes
- `200 OK` — Success
- `201 Created` — Resource created
- `202 Accepted` — Async processing started
- `204 No Content` — Success with no response body
- `400 Bad Request` — Invalid input
- `401 Unauthorized` — Authentication required
- `404 Not Found` — Resource not found
- `500 Internal Server Error` — Server error

---

## 🔑 Authentication (Future)

Currently, no authentication. Future versions will include:
- API Key authentication
- JWT bearer tokens
- OAuth 2.0

---

## 📈 Rate Limiting (Future)

Rate limits will be implemented per API key.

---

## 🧪 Testing with cURL

```bash
# Upload audio
curl -X POST http://localhost:5000/api/audio/upload \
  -F "file=@drum_loop.wav" \
  -F "projectId=proj-001"

# Detect hits
curl -X POST http://localhost:5000/api/detection/detect \
  -H "Content-Type: application/json" \
  -d '{
    "audioId": "audio-001",
    "sensitivity": 0.7,
    "threshold": -18
  }'

# Generate kit
curl -X POST http://localhost:5000/api/kits/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Modern hip-hop kit",
    "style": "hiphop"
  }'

# Export MIDI
curl -X POST http://localhost:5000/api/midi/export \
  -H "Content-Type: application/json" \
  -d '{
    "detectionId": "detect-001",
    "format": "midi"
  }'
```

---

## 📚 Additional Resources

- Swagger UI: `http://localhost:5000/swagger`
- OpenAPI Schema: `http://localhost:5000/swagger/v1/swagger.json`
- [Setup Guide](./SETUP.md)
- [Architecture Docs](./ARCHITECTURE.md)
