namespace DrumTracker.API.Models.Requests
{
    /// <summary>
    /// Request model for hit detection.
    /// </summary>
    public class HitDetectionRequest
    {
        /// <summary>
        /// ID of the audio file to process.
        /// </summary>
        public string AudioId { get; set; }

        /// <summary>
        /// Detection sensitivity (0.0 - 1.0). Higher = more sensitive.
        /// </summary>
        public float Sensitivity { get; set; } = 0.7f;

        /// <summary>
        /// Threshold in dB below which hits are not detected.
        /// </summary>
        public float Threshold { get; set; } = -18f;

        /// <summary>
        /// Pre-filter frequency in milliseconds.
        /// </summary>
        public int PreFilter { get; set; } = 15;

        /// <summary>
        /// Classification mode (default, aggressive, conservative).
        /// </summary>
        public string ClassificationMode { get; set; } = "default";
    }
}
