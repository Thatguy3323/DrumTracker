using System;
using System.Threading.Tasks;

namespace DrumTracker.API.Services
{
    /// <summary>
    /// Base interface for all audio processing engines.
    /// </summary>
    public interface IEngineBase
    {
        /// <summary>
        /// Engine name/identifier.
        /// </summary>
        string Name { get; }

        /// <summary>
        /// Engine version.
        /// </summary>
        string Version { get; }

        /// <summary>
        /// Gets or sets whether the engine is ready for processing.
        /// </summary>
        bool IsReady { get; }

        /// <summary>
        /// Initializes the engine.
        /// </summary>
        Task InitializeAsync();

        /// <summary>
        /// Cleans up resources.
        /// </summary>
        Task ShutdownAsync();
    }
}
