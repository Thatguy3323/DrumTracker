from midiutil import MIDIFile
import io

DRUM_MIDI_NOTES = {
    "kick": 36,
    "snare": 38,
    "hihat": 42,
    "tom": 45,
    "crash": 49,
    "ride": 51,
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
        midi = MIDIFile(1)
        track = 0
        midi.addTempo(track, 0, tempo)
        midi.addTimeSignature(track, 0, time_sig_num, int(time_sig_den).bit_length() - 1, 24)

        beats_per_second = tempo / 60.0

        for hit in hits:
            timestamp_sec = hit.get("timestamp", 0.0)
            beat_time = timestamp_sec * beats_per_second
            drum_type = hit.get("drum_type", "snare")
            velocity = int(hit.get("velocity", 80))
            note = DRUM_MIDI_NOTES.get(drum_type, 38)
            duration = 0.1  # short note

            midi.addNote(
                track=track,
                channel=DRUM_CHANNEL,
                pitch=note,
                time=beat_time,
                duration=duration,
                volume=velocity,
            )

        buf = io.BytesIO()
        midi.writeFile(buf)
        buf.seek(0)
        return buf.read()
