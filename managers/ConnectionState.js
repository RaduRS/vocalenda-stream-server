import { AudioStreamManager } from './AudioStreamManager.js';
import { SilenceDetectionManager } from './SilenceDetectionManager.js';
import { TranscriptManager } from './TranscriptManager.js';

/**
 * ConnectionState class - orchestrates all connection-specific managers
 * Follows separation of concerns and DRY principles
 * Each connection gets its own isolated state to prevent interference
 */
export class ConnectionState {
  constructor(callSid) {
    this.callSid = callSid;
    this.audioManager = new AudioStreamManager();
    this.silenceManager = new SilenceDetectionManager();
    this.transcriptManager = new TranscriptManager(callSid);
    this.createdAt = new Date().toISOString();
  }
  
  // Delegate methods for backward compatibility and clean API
  pauseSilenceTimer(reason, timestamp) {
    this.silenceManager.pauseTimer(reason, timestamp);
  }
  
  resumeSilenceTimer(reason, timestamp) {
    this.silenceManager.resumeTimer(reason, timestamp);
  }
  
  addTranscriptEntry(speaker, text, timestamp) {
    return this.transcriptManager.addEntry(speaker, text, timestamp);
  }
  
  // Convenience methods for common operations
  getCallSid() {
    return this.callSid;
  }
  
  getAudioManager() {
    return this.audioManager;
  }
  
  getSilenceManager() {
    return this.silenceManager;
  }
  
  getTranscriptManager() {
    return this.transcriptManager;
  }
  
  // State inspection methods
  isAudioStreaming() {
    return this.audioManager.isStreamingAudio;
  }
  
  isSilenceTimerPaused() {
    return this.silenceManager.isTimerPaused();
  }
  
  getTranscriptCount() {
    return this.transcriptManager.getEntryCount();
  }
  
  // Complete cleanup of all managers
  cleanup() {
    console.log(`🧹 CLEANUP: Cleaning up connection state for call ${this.callSid}`);
    this.audioManager.cleanup();
    this.silenceManager.cleanup();
    this.transcriptManager.clear();
  }
  
  // Debug information
  getDebugInfo() {
    return {
      callSid: this.callSid,
      createdAt: this.createdAt,
      audioStreaming: this.isAudioStreaming(),
      silenceTimerPaused: this.isSilenceTimerPaused(),
      transcriptEntries: this.getTranscriptCount(),
      silenceDuration: this.silenceManager.getSilenceDuration()
    };
  }
}