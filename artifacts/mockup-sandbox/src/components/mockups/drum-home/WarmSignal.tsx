import React from 'react';
import { Upload, Activity, Disc3, Download, Cpu } from 'lucide-react';
import './_warm.css';

export function WarmSignal() {
  const steps = [
    {
      id: 1,
      title: 'Upload Audio',
      description: 'Drop your raw drum stems. We support WAV, AIFF, and MP3 up to 24-bit/96kHz.',
      icon: <Upload className="w-6 h-6 text-[#FF9500]" />
    },
    {
      id: 2,
      title: 'Detect Hits',
      description: 'Our DSP analyzes transients to perfectly isolate kicks, snares, and toms.',
      icon: <Activity className="w-6 h-6 text-[#FF9500]" />
    },
    {
      id: 3,
      title: 'Select Kit',
      description: 'Map detections to premium multi-sampled drum libraries.',
      icon: <Disc3 className="w-6 h-6 text-[#FF9500]" />
    },
    {
      id: 4,
      title: 'Export MIDI',
      description: 'Download velocity-sensitive MIDI for seamless integration in your DAW.',
      icon: <Download className="w-6 h-6 text-[#FF9500]" />
    }
  ];

  return (
    <div className="min-h-screen analog-bg text-[#ffedd5] font-sans relative overflow-x-hidden flex flex-col selection:bg-[#FF9500]/30">
      {/* Background Image Overlay */}
      <div 
        className="absolute inset-0 z-0 opacity-15 mix-blend-lighten pointer-events-none transition-opacity duration-1000"
        style={{
          backgroundImage: 'url(/__mockup/images/analog-studio.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      
      {/* Subtle top light leak */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-[#FF9500] opacity-5 blur-[120px] pointer-events-none rounded-full" />

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col px-6 py-12 md:px-12 max-w-6xl mx-auto w-full h-full justify-between">
        
        {/* Header */}
        <header className="flex flex-col items-center text-center space-y-6 mt-8 md:mt-16 mb-16">
          <div className="inline-flex items-center space-x-3 analog-border px-4 py-1.5 rounded-full glass-panel mb-4">
            <span className="w-2 h-2 rounded-full bg-[#FFD60A] shadow-[0_0_8px_#FFD60A] animate-pulse"></span>
            <span className="text-xs uppercase tracking-widest text-[#FF9500] font-space font-semibold">System Online</span>
          </div>
          
          <h1 className="font-space text-5xl md:text-7xl font-bold tracking-tight text-white">
            <span className="text-transparent bg-clip-text bg-gradient-to-br from-[#FFD60A] via-[#FF9500] to-[#b35900] text-glow">
              DrumTracker
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-[#ffedd5]/70 max-w-2xl font-light leading-relaxed">
            Studio-grade drum replacement. Turn raw multitracks into pristine MIDI in seconds with precision transient detection.
          </p>
        </header>

        {/* Workflow Steps */}
        <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full mb-16">
          {steps.map((step) => (
            <div 
              key={step.id}
              className="glass-panel analog-border rounded-xl p-6 relative group transition-all duration-300 analog-glow cursor-pointer hover:-translate-y-1"
            >
              <div className="absolute -top-3 -right-3 text-6xl font-space font-bold text-[#FF9500]/10 group-hover:text-[#FF9500]/20 transition-colors">
                0{step.id}
              </div>
              
              <div className="w-12 h-12 rounded-lg bg-[#2a1100] border border-[#FF9500]/30 flex items-center justify-center mb-6 shadow-[inset_0_0_15px_rgba(255,149,0,0.1)]">
                {step.icon}
              </div>
              
              <h3 className="font-space text-xl font-semibold text-[#FFD60A] mb-3">{step.title}</h3>
              <p className="text-[#ffedd5]/60 text-sm leading-relaxed">
                {step.description}
              </p>
              
              <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-[#FF9500] to-[#FFD60A] w-0 group-hover:w-full transition-all duration-500 rounded-b-xl opacity-50" />
            </div>
          ))}
        </main>

        {/* Footer / DSP Note */}
        <footer className="mt-auto border-t border-[#FF9500]/20 pt-8 pb-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-[#ffedd5]/50">
            <div className="flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-[#FF9500]/70" />
              <span className="font-space uppercase tracking-wider text-xs">DSP Engine v2.4.1</span>
            </div>
            <div className="flex items-center space-x-4">
              <span>Latency: 2.1ms</span>
              <span className="w-1 h-1 rounded-full bg-[#FF9500]/50" />
              <span>Buffer: 256smp</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
