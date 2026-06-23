using System;

namespace DrumTracker.UI.Navigation
{
    /// <summary>
    /// Navigation service implementation.
    /// </summary>
    public class NavigationService : INavigationService
    {
        private PageKey _currentPage = PageKey.Home;

        public PageKey CurrentPage => _currentPage;

        public event EventHandler<PageKey> NavigatedTo;

        /// <summary>
        /// Navigates to the specified page.
        /// </summary>
        public void NavigateTo(PageKey page)
        {
            if (_currentPage != page)
            {
                _currentPage = page;
                OnNavigatedTo(page);
            }
        }

        /// <summary>
        /// Raises the NavigatedTo event.
        /// </summary>
        protected virtual void OnNavigatedTo(PageKey page)
        {
            NavigatedTo?.Invoke(this, page);
        }
    }
}
