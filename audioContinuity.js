/**
 * Audio Continuity System
 * Handles smooth audio transitions during function calls to prevent crackling
 */

import { BufferManager } from './bufferManager.js';

class AudioContinuityManager {
  constructor() {
    this.audioBuffer = [];
    this.isBuffering = false;
    this.bufferTimeout = null;
    this.transitionState = 'normal'; // 'normal', 'function_call', 'resuming'
    this.lastAudioTime = Date.now();
    this.silenceThreshold = 100; // ms of silence before considering transition
    this.maxBufferSize = 10; // Maximum audio chunks to buffer
    
    // Initialize buffer manager for advanced buffering
    this.bufferManager = new BufferManager({
      maxBufferSize: 30,
      minBufferSize: 3,
      bufferTimeout: 3000,
      chunkDelay: 15
    });
    
    // Set up buffer manager release callback
    this.bufferManager.setReleaseCallback((audioData, metadata) => {
      if (this.forwardFunction) {
        return this.forwardFunction(audioData);
      }
    });
  }

  /**
   * Start buffering audio during function call processing
   */
  startFunctionCallTransition() {
    console.log('🔄 AUDIO_CONTINUITY: Starting function call transition');
    this.transitionState = 'function_call';
    this.isBuffering = true;
    this.audioBuffer = [];
    
    // Start buffer manager buffering
    this.bufferManager.startBuffering('function_call_transition');
    
    // Set timeout to prevent infinite buffering
    this.bufferTimeout = setTimeout(() => {
      this.endFunctionCallTransition();
    }, 5000); // 5 second max buffer time
  }

  /**
   * End function call transition and resume normal audio flow
   */
  endFunctionCallTransition() {
    console.log('✅ AUDIO_CONTINUITY: Ending function call transition');
    this.transitionState = 'resuming';
    this.isBuffering = false;
    
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
      this.bufferTimeout = null;
    }
    
    // Start buffer manager release
    this.bufferManager.startRelease();
    
    // Also gradually release simple buffered audio for backward compatibility
    this.releaseBufferedAudio();
  }

  /**
   * Process incoming audio with continuity management
   */
  processAudioChunk(audioData, forwardFunction) {
    this.lastAudioTime = Date.now();
    
    if (this.isBuffering && this.transitionState === 'function_call') {
      // Use buffer manager for advanced buffering during function calls
      this.bufferManager.addChunk(audioData, {
        source: 'function_call_buffer',
        timestamp: Date.now()
      });
      
      // Also maintain simple buffer for backward compatibility
      if (this.audioBuffer.length < this.maxBufferSize) {
        this.audioBuffer.push({
          data: audioData,
          timestamp: Date.now()
        });
        console.log(`📦 AUDIO_CONTINUITY: Buffered chunk (${this.audioBuffer.length}/${this.maxBufferSize})`);
      } else {
        // Buffer is full, start releasing oldest chunks
        this.audioBuffer.shift();
        this.audioBuffer.push({
          data: audioData,
          timestamp: Date.now()
        });
      }
    } else {
      // Normal audio flow - use buffer manager for smooth delivery
      if (this.transitionState === 'normal') {
        // Direct forwarding for normal state
        forwardFunction(audioData);
      } else {
        // Use buffer manager for resuming state
        this.bufferManager.addChunk(audioData, {
          source: 'normal_flow',
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Gradually release buffered audio chunks
   */
  async releaseBufferedAudio() {
    if (this.audioBuffer.length === 0) {
      this.transitionState = 'normal';
      return;
    }

    console.log(`🎵 AUDIO_CONTINUITY: Releasing ${this.audioBuffer.length} buffered chunks`);
    
    // Release chunks with small delays to prevent audio burst
    for (let i = 0; i < this.audioBuffer.length; i++) {
      const chunk = this.audioBuffer[i];
      
      // Small delay between chunks for smooth playback
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 20)); // 20ms delay
      }
      
      // Forward the buffered audio
      try {
        // This will be set by the caller
        if (this.forwardFunction) {
          this.forwardFunction(chunk.data);
        }
      } catch (error) {
        console.error('❌ AUDIO_CONTINUITY: Error releasing buffered audio:', error);
      }
    }
    
    this.audioBuffer = [];
    this.transitionState = 'normal';
    console.log('✅ AUDIO_CONTINUITY: All buffered audio released');
  }

  /**
   * Set the forward function for releasing buffered audio
   */
  setForwardFunction(forwardFunction) {
    this.forwardFunction = forwardFunction;
  }

  /**
   * Check if audio flow has been silent for too long
   */
  checkAudioHealth() {
    const timeSinceLastAudio = Date.now() - this.lastAudioTime;
    
    if (timeSinceLastAudio > 10000) { // 10 seconds of silence
      console.warn('⚠️ AUDIO_CONTINUITY: Long audio silence detected');
      return false;
    }
    
    return true;
  }

  /**
   * Get current audio continuity status
   */
  getStatus() {
    const bufferStatus = this.bufferManager.getStatus();
    return {
      transitionState: this.transitionState,
      isBuffering: this.isBuffering,
      bufferSize: this.audioBuffer.length,
      timeSinceLastAudio: Date.now() - this.lastAudioTime,
      bufferManager: {
        bufferSize: bufferStatus.bufferSize,
        isBuffering: bufferStatus.isBuffering,
        isReleasing: bufferStatus.isReleasing,
        totalChunksProcessed: bufferStatus.totalChunksProcessed,
        droppedChunks: bufferStatus.droppedChunks,
        metrics: bufferStatus.metrics
      }
    };
  }

  /**
   * Reset the audio continuity manager
   */
  reset() {
    this.audioBuffer = [];
    this.isBuffering = false;
    this.transitionState = 'normal';
    
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
      this.bufferTimeout = null;
    }
    
    // Reset buffer manager
    this.bufferManager.clearBuffer();
    this.bufferManager.resetStats();
  }
}

export { AudioContinuityManager };