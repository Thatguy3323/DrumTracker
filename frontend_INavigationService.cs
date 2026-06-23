using System;

namespace DrumTracker.UI.Navigation
{
    /// <summary>
    /// Interface for navigation service.
    /// </summary>
    public interface INavigationService
    {
        /// <summary>
        /// Navigates to a page.
        /// </summary>
        void NavigateTo(PageKey page);

        /// <summary>
        /// Gets the current page.
        /// </summary>
        PageKey CurrentPage { get; }

        /// <summary>
        /// Event raised when navigation occurs.
        /// </summary>
        event EventHandler<PageKey> NavigatedTo;
    }
}
