using System;
using System.Collections.Generic;

namespace DrumTracker.API.Models.Responses
{
    /// <summary>
    /// Represents a detected drum hit.
    /// </summary>
    public class DrumHit
    {
        /// <summary>
        /// Time position in seconds.
        /// </summary>
        public double Timestamp { get; set; }

        /// <summary>
        /// Type of drum (kick, snare, tom, hihat).
        /// </summary>
        public string DrumType { get; set; }

        /// <summary>
        /// MIDI velocity (0-127).
        /// </summary>
        public byte Velocity { get; set; }

        /// <summary>
        /// Confidence score (0.0 - 1.0).
        /// </summary>
        public float Confidence { get; set; }
    }

    /// <summary>
    /// Response model for hit detection.
    /// </summary>
    public class HitDetectionResponse
    {
        /// <summary>
        /// Unique detection session ID.
        /// </summary>
        public string DetectionId { get; set; }

        /// <summary>
        /// Source audio file ID.
        /// </summary>
        public string AudioId { get; set; }

        /// <summary>
        /// Total number of hits detected.
        /// </summary>
        public int TotalHits { get; set; }

        /// <summary>
        /// Breakdown of hits by drum type.
        /// </summary>
        public Dictionary<string, int> HitsByType { get; set; } = new();

        /// <summary>
        /// Overall detection confidence (0.0 - 1.0).
        /// </summary>
        public float Confidence { get; set; }

        /// <summary>
        /// Processing time in seconds.
        /// </summary>
        public double ProcessingTime { get; set; }

        /// <summary>
        /// List of detected hits with detailed information.
        /// </summary>
        public List<DrumHit> Hits { get; set; } = new();

        /// <summary>
        /// Timestamp when detection was completed.
        /// </summary>
        public DateTime CompletedAt { get; set; } = DateTime.UtcNow;
    }
}
