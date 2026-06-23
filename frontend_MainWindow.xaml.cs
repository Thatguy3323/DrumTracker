using System.Windows;
using DrumTracker.UI.Navigation;

namespace DrumTracker.UI
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        public MainWindow()
        {
            InitializeComponent();
            this.DataContext = new MainWindowViewModel();
        }
    }

    /// <summary>
    /// Main window view model.
    /// </summary>
    public class MainWindowViewModel : PageViewModel
    {
        private string _pageTitle = "Welcome to DrumTracker";
        private INavigationService _navigationService;

        public string PageTitle
        {
            get => _pageTitle;
            set => SetProperty(ref _pageTitle, value);
        }

        public MainWindowViewModel()
        {
            // Initialize navigation service
            _navigationService = new NavigationService();
            
            // Set default page
            LoadPage(PageKey.Home);
        }

        /// <summary>
        /// Loads a page based on the page key.
        /// </summary>
        private void LoadPage(PageKey key)
        {
            switch (key)
            {
                case PageKey.Home:
                    PageTitle = "Home";
                    break;
                case PageKey.AudioProcessing:
                    PageTitle = "Audio Processing";
                    break;
                case PageKey.HitDetection:
                    PageTitle = "Hit Detection";
                    break;
                case PageKey.AIKits:
                    PageTitle = "AI Kits";
                    break;
                case PageKey.DrumReplacement:
                    PageTitle = "Drum Replacement";
                    break;
                case PageKey.MIDIExport:
                    PageTitle = "MIDI Export";
                    break;
                case PageKey.Settings:
                    PageTitle = "Settings";
                    break;
            }
        }
    }
}
