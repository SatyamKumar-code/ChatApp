// Browser Web Audio API Call Tone Generator (No external audio files needed)

let audioCtx = null;
let currentInterval = null;
let activeOscillators = [];

const getAudioContext = () => {
    if (!audioCtx || audioCtx.state === "closed") {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    return audioCtx;
};

export const stopAllCallSounds = () => {
    if (currentInterval) {
        clearInterval(currentInterval);
        currentInterval = null;
    }

    activeOscillators.forEach((osc) => {
        try {
            osc.stop();
            osc.disconnect();
        } catch (e) {
            // Already stopped
        }
    });
    activeOscillators = [];
};

// Play Outgoing Ringtone (Double-pulse US phone ringing)
export const playOutgoingRing = () => {
    stopAllCallSounds();
    const ctx = getAudioContext();
    if (!ctx) return;

    const playRingCycle = () => {
        try {
            const now = ctx.currentTime;

            // Dual tone: 440Hz + 480Hz
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = "sine";
            osc2.type = "sine";
            osc1.frequency.setValueAtTime(440, now);
            osc2.frequency.setValueAtTime(480, now);

            // Smooth envelope: 1.5s ring, 2.5s silence
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
            gain.gain.setValueAtTime(0.12, now + 1.4);
            gain.gain.linearRampToValueAtTime(0, now + 1.5);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 1.6);
            osc2.stop(now + 1.6);

            activeOscillators.push(osc1, osc2);
        } catch (err) {
            console.error("Audio synth error:", err);
        }
    };

    playRingCycle();
    currentInterval = setInterval(playRingCycle, 4000);
};

// Play Incoming Ringtone (Sleek modern marimba chime)
export const playIncomingRing = () => {
    stopAllCallSounds();
    if (typeof window !== "undefined" && localStorage.getItem("chatapp_sound") === "false") {
        return;
    }
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [
        { freq: 523.25, time: 0 },    // C5
        { freq: 659.25, time: 0.15 }, // E5
        { freq: 783.99, time: 0.3 },  // G5
        { freq: 1046.5, time: 0.45 }, // C6
        { freq: 783.99, time: 0.7 },  // G5
        { freq: 1046.5, time: 0.85 }, // C6
    ];

    const playMelodyCycle = () => {
        try {
            const start = ctx.currentTime;

            notes.forEach(({ freq, time }) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, start + time);

                gain.gain.setValueAtTime(0, start + time);
                gain.gain.linearRampToValueAtTime(0.15, start + time + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, start + time + 0.35);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(start + time);
                osc.stop(start + time + 0.4);

                activeOscillators.push(osc);
            });
        } catch (err) {
            console.error("Incoming audio error:", err);
        }
    };

    playMelodyCycle();
    currentInterval = setInterval(playMelodyCycle, 2400);
};

// Play End Call / Busy Tone
export const playEndCallTone = () => {
    stopAllCallSounds();
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.linearRampToValueAtTime(200, now + 0.25);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.35);
    } catch (e) {
        // Ignored
    }
};

// Play Crisp Notification Chime for Incoming Messages
export const playMessageSound = () => {
    if (typeof window !== "undefined" && localStorage.getItem("chatapp_sound") === "false") {
        return;
    }
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
        const now = ctx.currentTime;
        [
            { freq: 880, start: 0, dur: 0.18, vol: 0.08 },
            { freq: 1174.66, start: 0.08, dur: 0.28, vol: 0.1 }
        ].forEach(({ freq, start, dur, vol }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, now + start);

            gain.gain.setValueAtTime(0, now + start);
            gain.gain.linearRampToValueAtTime(vol, now + start + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + start);
            osc.stop(now + start + dur + 0.05);
        });
    } catch (err) {
        // AudioContext might be waiting for user gesture or unavailable
    }
};
