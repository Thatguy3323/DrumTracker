from midiutil import MIDIFile
import io

DRUM_MIDI_NOTES = {
    "kick":  36,
    "snare": 38,
    "hihat": 42,
    "tom":   45,
    "crash": 49,
    "ride":  51,
}

TRACK_ORDER = ["kick", "snare", "hihat", "tom", "crash", "ride"]
TRACK_NAMES = {
    "kick":  "Kick",
    "snare": "Snare",
    "hihat": "Hi-Hat",
    "tom":   "Tom",
    "crash": "Crash",
    "ride":  "Ride",
}

DRUM_CHANNEL = 9  # GM standard drum channel


class MidiExportEngine:
    def generate_midi(
        self,
        hits: list,
        tempo: int = 120,
        time_sig_num: int = 4,
        time_sig_den: int = 4,
    ) -> bytes:
        beats_per_second = tempo / 60.0

        # Group hits by drum type
        hits_by_type: dict[str, list] = {}
        for hit in hits:
            drum_type = hit.get("drum_type", "snare")
            hits_by_type.setdefault(drum_type, []).append(hit)

        # Build ordered list of drum types present, keeping canonical order
        present_types = [t for t in TRACK_ORDER if t in hits_by_type]
        # Append any unexpected types at the end
        for t in hits_by_type:
            if t not in present_types:
                present_types.append(t)

        num_tracks = max(len(present_types), 1)
        midi = MIDIFile(num_tracks, deinterleave=False)

        for track_idx, drum_type in enumerate(present_types):
            track_name = TRACK_NAMES.get(drum_type, drum_type.capitalize())
            midi.addTrackName(track_idx, 0, track_name)
            midi.addTempo(track_idx, 0, tempo)
            midi.addTimeSignature(
                track_idx, 0,
                time_sig_num,
                int(time_sig_den).bit_length() - 1,
                24,
            )

            note = DRUM_MIDI_NOTES.get(drum_type, 38)
            for hit in hits_by_type[drum_type]:
                timestamp_sec = hit.get("timestamp", 0.0)
                beat_time = timestamp_sec * beats_per_second
                velocity = int(hit.get("velocity", 80))
                midi.addNote(
                    track=track_idx,
                    channel=DRUM_CHANNEL,
                    pitch=note,
                    time=beat_time,
                    duration=0.1,
                    volume=velocity,
                )

        buf = io.BytesIO()
        midi.writeFile(buf)
        buf.seek(0)
        return buf.read()
