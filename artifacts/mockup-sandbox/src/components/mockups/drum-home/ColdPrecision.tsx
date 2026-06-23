import React from 'react';
import './_cold.css';

const UploadSVG = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);
const ActivitySVG = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const LayersSVG = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
  </svg>
);
const DownloadSVG = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const CpuSVG = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/>
    <line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/>
    <line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/>
    <line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/>
    <line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>
  </svg>
);
const TerminalSVG = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
  </svg>
);
const SettingsSVG = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

export function ColdPrecision() {
  return (
    <div className="min-h-screen bg-clinical-black text-clinical-white font-sans-clinical grid-bg scanline-container scanline-sweep p-4 md:p-8 flex flex-col relative">

      <header className="w-full flex justify-between items-center border-b border-clinical-cyan pb-4 mb-12">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 flex items-center justify-center border border-clinical-cyan bg-clinical-black text-clinical-cyan">
            <ActivitySVG size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-widest text-clinical-cyan font-mono-clinical uppercase">
              DrumTracker
            </h1>
            <p className="text-xs font-mono-clinical opacity-70 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-clinical-cyan animate-pulse inline-block"></span>
              SYS.ONLINE // V.2.0.4
            </p>
          </div>
        </div>

        <div className="hidden md:flex gap-8 font-mono-clinical text-xs opacity-70">
          <div className="flex flex-col">
            <span className="text-clinical-cyan">CPU_LOAD</span>
            <span>12.4%</span>
          </div>
          <div className="flex flex-col">
            <span className="text-clinical-cyan">MEM_ALLOC</span>
            <span>4096 MB</span>
          </div>
          <div className="flex flex-col">
            <span className="text-clinical-cyan">LATENCY</span>
            <span>1.2ms</span>
          </div>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center max-w-6xl mx-auto w-full">
        <div className="text-center mb-16 relative">
          <h2 className="text-4xl md:text-5xl font-mono-clinical font-light mb-4 text-clinical-white tracking-tight">
            Precision Audio-to-MIDI <br />
            <span className="text-clinical-cyan font-bold">Extraction Engine</span>
          </h2>
          <p className="font-mono-clinical opacity-60 max-w-2xl mx-auto text-sm md:text-base border-l-2 border-clinical-cyan pl-4 text-left">
            {'>'} INITIALIZING NEURAL TRANSIENT DETECTION...<br/>
            {'>'} READY FOR MULTITRACK AUDIO INPUT. <span className="blinking-cursor">_</span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full mb-16">
          <WorkflowCard step="01" title="INPUT_AUDIO" desc="Ingest multitrack drum recordings or stems into the analysis buffer." icon={<UploadSVG />} />
          <WorkflowCard step="02" title="DETECT_TRANSIENTS" desc="Run sub-millisecond precision spectral analysis to isolate drum hits." icon={<ActivitySVG size={20} />} />
          <WorkflowCard step="03" title="MAP_SAMPLES" desc="Assign detected transients to target instruments and velocity layers." icon={<LayersSVG />} />
          <WorkflowCard step="04" title="EXPORT_DATA" desc="Generate phase-accurate MIDI sequences for external synthesis." icon={<DownloadSVG />} />
        </div>
      </main>

      <footer className="w-full mt-auto border-t border-clinical-cyan pt-6 font-mono-clinical text-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-clinical-cyan/60">
        <div className="flex items-center gap-3">
          <span className="text-clinical-cyan"><CpuSVG /></span>
          <div className="flex flex-col">
            <span className="text-clinical-cyan font-bold tracking-wider uppercase">DSP_ENGINE_STATUS</span>
            <span>librosa onset_detect → FFT spectral bands → midiutil export · Running Phase-Aligned Transient v3.1</span>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="px-3 py-1 border border-clinical-cyan/30 rounded flex items-center gap-2">
            <SettingsSVG /> CONFIG
          </div>
          <div className="px-3 py-1 border border-clinical-cyan/30 rounded flex items-center gap-2">
            <TerminalSVG /> LOGS
          </div>
        </div>
      </footer>
    </div>
  );
}

function WorkflowCard({ step, title, desc, icon }: { step: string; title: string; desc: string; icon: React.ReactNode }) {
  return (
    <div className="clinical-card p-6 cursor-pointer group flex flex-col h-full">
      <div className="flex justify-between items-start mb-6">
        <span className="font-mono-clinical text-3xl font-bold text-clinical-cyan opacity-40 group-hover:opacity-100 transition-opacity">
          {step}
        </span>
        <div className="p-2 border border-clinical-cyan/30 rounded-sm text-clinical-cyan group-hover:bg-clinical-cyan/10 transition-colors">
          {icon}
        </div>
      </div>
      <h3 className="font-mono-clinical text-lg font-bold mb-3 tracking-wide text-clinical-white group-hover:text-clinical-cyan transition-colors">
        {title}
      </h3>
      <p className="font-mono-clinical text-sm opacity-60 leading-relaxed flex-grow">{desc}</p>
      <div className="mt-6 pt-4 border-t border-clinical-cyan/20 w-full flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="font-mono-clinical text-xs text-clinical-cyan">EXECUTE</span>
        <div className="w-4 h-4 border-b-2 border-r-2 border-clinical-cyan transform -rotate-45"></div>
      </div>
    </div>
  );
}
