import React from "react";
import { Upload, Activity, Disc, Download, ChevronRight, Cpu } from "lucide-react";

export function RawIndustrial() {
  return (
    <div
      className="min-h-screen font-sans selection:bg-[#39FF14] selection:text-black"
      style={{
        backgroundColor: "#0A0A0A",
        color: "#F0F0F0",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-16 flex flex-col gap-16">
        {/* Header */}
        <header className="border-b-[4px] border-[#F0F0F0] pb-8 flex flex-col md:flex-row justify-between items-end gap-6">
          <div className="space-y-2">
            <h1
              className="text-6xl md:text-8xl font-black uppercase tracking-tighter"
              style={{ letterSpacing: "-0.05em" }}
            >
              Drum<span className="text-[#39FF14]">Tracker</span>
            </h1>
            <p className="text-xl md:text-2xl font-bold text-[#888888] uppercase tracking-widest">
              Audio to MIDI translation engine
            </p>
          </div>
          <div className="text-right">
            <span className="inline-block bg-[#39FF14] text-black font-black uppercase tracking-widest px-3 py-1 text-sm border-2 border-[#39FF14]">
              System Active
            </span>
          </div>
        </header>

        {/* Workflow Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Step 01 */}
          <div className="group relative border-[4px] border-[#1C1C1C] hover:border-[#39FF14] transition-colors duration-0 bg-[#1C1C1C] hover:bg-transparent cursor-pointer flex flex-col p-6">
            <div className="absolute top-4 right-4 text-[#39FF14] opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight size={32} strokeWidth={3} />
            </div>
            <div className="text-8xl md:text-9xl font-black text-[#0A0A0A] group-hover:text-[#F0F0F0] leading-none mb-4 -ml-2 select-none transition-colors duration-0">
              01
            </div>
            <div className="mt-auto pt-8 flex items-center gap-4">
              <Upload size={40} className="text-[#39FF14]" strokeWidth={2.5} />
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tight">Upload Audio</h2>
                <p className="text-[#888888] font-medium mt-1">Import multitrack drum recordings</p>
              </div>
            </div>
          </div>

          {/* Step 02 */}
          <div className="group relative border-[4px] border-[#1C1C1C] hover:border-[#39FF14] transition-colors duration-0 bg-[#1C1C1C] hover:bg-transparent cursor-pointer flex flex-col p-6 md:mt-16">
            <div className="absolute top-4 right-4 text-[#39FF14] opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight size={32} strokeWidth={3} />
            </div>
            <div className="text-8xl md:text-9xl font-black text-[#0A0A0A] group-hover:text-[#F0F0F0] leading-none mb-4 -ml-2 select-none transition-colors duration-0">
              02
            </div>
            <div className="mt-auto pt-8 flex items-center gap-4">
              <Activity size={40} className="text-[#39FF14]" strokeWidth={2.5} />
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tight">Detect Hits</h2>
                <p className="text-[#888888] font-medium mt-1">Transient analysis and threshold tuning</p>
              </div>
            </div>
          </div>

          {/* Step 03 */}
          <div className="group relative border-[4px] border-[#1C1C1C] hover:border-[#39FF14] transition-colors duration-0 bg-[#1C1C1C] hover:bg-transparent cursor-pointer flex flex-col p-6">
            <div className="absolute top-4 right-4 text-[#39FF14] opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight size={32} strokeWidth={3} />
            </div>
            <div className="text-8xl md:text-9xl font-black text-[#0A0A0A] group-hover:text-[#F0F0F0] leading-none mb-4 -ml-2 select-none transition-colors duration-0">
              03
            </div>
            <div className="mt-auto pt-8 flex items-center gap-4">
              <Disc size={40} className="text-[#39FF14]" strokeWidth={2.5} />
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tight">Select Kit</h2>
                <p className="text-[#888888] font-medium mt-1">Map to internal samples or custom VST</p>
              </div>
            </div>
          </div>

          {/* Step 04 */}
          <div className="group relative border-[4px] border-[#1C1C1C] hover:border-[#39FF14] transition-colors duration-0 bg-[#1C1C1C] hover:bg-transparent cursor-pointer flex flex-col p-6 md:mt-16">
            <div className="absolute top-4 right-4 text-[#39FF14] opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight size={32} strokeWidth={3} />
            </div>
            <div className="text-8xl md:text-9xl font-black text-[#0A0A0A] group-hover:text-[#F0F0F0] leading-none mb-4 -ml-2 select-none transition-colors duration-0">
              04
            </div>
            <div className="mt-auto pt-8 flex items-center gap-4">
              <Download size={40} className="text-[#39FF14]" strokeWidth={2.5} />
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tight">Export MIDI</h2>
                <p className="text-[#888888] font-medium mt-1">Generate velocity-mapped MIDI track</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer / DSP Note */}
        <footer className="mt-12 border-t-[4px] border-[#1C1C1C] pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3 text-[#888888]">
            <Cpu size={24} className="text-[#F0F0F0]" />
            <span className="font-mono text-sm uppercase tracking-wider">
              DSP Engine v2.4.1 // Latency: &lt;2ms
            </span>
          </div>
          <button className="bg-[#F0F0F0] text-[#0A0A0A] border-none px-8 py-4 font-black uppercase tracking-widest text-lg hover:bg-[#39FF14] transition-colors duration-0 flex items-center gap-2">
            Initialize Session
            <ChevronRight size={24} strokeWidth={3} />
          </button>
        </footer>
      </div>
    </div>
  );
}
