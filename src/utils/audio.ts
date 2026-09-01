export function playBeepSound(type: 'purchase' | 'otp') {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'purchase') {
      // Short high pitched beep
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15);
    } else {
      // Dual double-beep on OTP arrival
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(1046.50, audioCtx.currentTime); // C6
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
      
      setTimeout(() => {
        try {
          const audioCtx2 = new (window.AudioContext || (window as any).webkitAudioContext)();
          if (audioCtx2.state === 'suspended') {
            audioCtx2.resume();
          }
          const osc2 = audioCtx2.createOscillator();
          const gain2 = audioCtx2.createGain();
          osc2.connect(gain2);
          gain2.connect(audioCtx2.destination);
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(1318.51, audioCtx2.currentTime); // E6
          gain2.gain.setValueAtTime(0.08, audioCtx2.currentTime);
          osc2.start();
          osc2.stop(audioCtx2.currentTime + 0.12);
        } catch (err) {
          // ignore
        }
      }, 150);
    }
  } catch (e) {
    console.error("Audio beep could not be played:", e);
  }
}
