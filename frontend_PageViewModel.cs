using DrumTracker.UI.Utils;

namespace DrumTracker.UI.Navigation
{
    /// <summary>
    /// Base class for page view models.
    /// </summary>
    public abstract class PageViewModel : ViewModelBase
    {
        private string _title;
        private bool _isBusy;
        private string _busyMessage = "Processing...";

        public string Title
        {
            get => _title;
            set => SetProperty(ref _title, value);
        }

        public bool IsBusy
        {
            get => _isBusy;
            set => SetProperty(ref _isBusy, value);
        }

        public string BusyMessage
        {
            get => _busyMessage;
            set => SetProperty(ref _busyMessage, value);
        }

        /// <summary>
        /// Called when the page is navigated to.
        /// </summary>
        public virtual void OnNavigatedTo()
        {
        }

        /// <summary>
        /// Called when the page is navigated away from.
        /// </summary>
        public virtual void OnNavigatedFrom()
        {
        }
    }
}
