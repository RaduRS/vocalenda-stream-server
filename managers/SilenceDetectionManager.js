/**
 * Silence detection manager - handles silence timeout logic
 * Separated for better modularity and testability
 */
export class SilenceDetectionManager {
  constructor() {
    this.silenceStartTime = null;
    this.silencePromptCount = 0;
    this.silenceTimeout = null;
    this.silenceTimerPaused = false;
    this.SILENCE_TIMEOUT_MS = 10000; // 10 seconds
  }
  
  pauseTimer(reason, timestamp = new Date().toISOString()) {
    console.log(`[${timestamp}] ⏸️ SILENCE: Pausing timer - ${reason}`);
    this.silenceTimerPaused = true;
    this._clearTimeout();
  }
  
  resumeTimer(reason, timestamp = new Date().toISOString()) {
    console.log(`[${timestamp}] ▶️ SILENCE: Resuming timer - ${reason}`);
    this.silenceTimerPaused = false;
  }
  
  startTracking(timestamp = new Date().toISOString()) {
    if (this.silenceTimerPaused) {
      console.log(`[${timestamp}] ⏸️ SILENCE: Timer paused, not starting tracking`);
      return;
    }
    
    this.silenceStartTime = Date.now();
    console.log(`[${timestamp}] 🔇 SILENCE: Started tracking`);
  }
  
  stopTracking(timestamp = new Date().toISOString()) {
    if (this.silenceStartTime) {
      console.log(`[${timestamp}] 🔊 SILENCE: Stopped tracking`);
      this.silenceStartTime = null;
      this._clearTimeout();
    }
  }
  
  resetTimer() {
    this.silenceStartTime = null;
    this.silencePromptCount = 0;
    this._clearTimeout();
  }
  
  setSilenceTimeout(callback, timeoutMs = this.SILENCE_TIMEOUT_MS) {
    this._clearTimeout();
    this.silenceTimeout = setTimeout(callback, timeoutMs);
  }
  
  isTimerPaused() {
    return this.silenceTimerPaused;
  }
  
  getSilenceDuration() {
    return this.silenceStartTime ? Date.now() - this.silenceStartTime : 0;
  }
  
  incrementPromptCount() {
    this.silencePromptCount++;
    return this.silencePromptCount;
  }
  
  _clearTimeout() {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
  }
  
  cleanup() {
    this._clearTimeout();
    this.resetTimer();
    this.silenceTimerPaused = false;
  }
}