/**
 * Buffer Management System
 * Handles audio buffering to prevent crackling during temporary processing delays
 */

class BufferManager {
  constructor(options = {}) {
    this.maxBufferSize = options.maxBufferSize || 50; // Maximum number of audio chunks
    this.minBufferSize = options.minBufferSize || 5;  // Minimum buffer before playback
    this.bufferTimeout = options.bufferTimeout || 2000; // Max time to buffer (ms)
    this.chunkDelay = options.chunkDelay || 20; // Delay between chunk releases (ms)
    
    this.audioBuffer = [];
    this.isBuffering = false;
    this.isReleasing = false;
    this.bufferStartTime = null;
    this.totalBytesBuffered = 0;
    this.totalChunksProcessed = 0;
    this.droppedChunks = 0;
    
    // Performance metrics
    this.metrics = {
      averageChunkSize: 0,
      bufferUtilization: 0,
      processingLatency: 0,
      lastUpdateTime: Date.now()
    };
  }

  /**
   * Add audio chunk to buffer
   */
  addChunk(audioData, metadata = {}) {
    const timestamp = Date.now();
    
    // Check if buffer is full
    if (this.audioBuffer.length >= this.maxBufferSize) {
      // Remove oldest chunk to make room
      const droppedChunk = this.audioBuffer.shift();
      this.droppedChunks++;
      console.warn(`⚠️ BUFFER_MANAGER: Buffer full, dropped chunk (${this.droppedChunks} total dropped)`);
    }
    
    // Add new chunk
    const chunk = {
      data: audioData,
      timestamp: timestamp,
      size: audioData.length || audioData.byteLength || 0,
      metadata: metadata
    };
    
    this.audioBuffer.push(chunk);
    this.totalBytesBuffered += chunk.size;
    this.totalChunksProcessed++;
    
    // Update metrics
    this.updateMetrics();
    
    console.log(`📦 BUFFER_MANAGER: Added chunk (${this.audioBuffer.length}/${this.maxBufferSize}, ${chunk.size} bytes)`);
    
    // Auto-start release if buffer reaches minimum size
    if (!this.isReleasing && this.audioBuffer.length >= this.minBufferSize) {
      this.startRelease();
    }
    
    return {
      bufferSize: this.audioBuffer.length,
      totalBytes: this.totalBytesBuffered,
      isBuffering: this.isBuffering
    };
  }

  /**
   * Start buffering mode
   */
  startBuffering(reason = 'unknown') {
    if (this.isBuffering) return;
    
    console.log(`🔄 BUFFER_MANAGER: Starting buffering (reason: ${reason})`);
    this.isBuffering = true;
    this.bufferStartTime = Date.now();
    
    // Set timeout to prevent infinite buffering
    setTimeout(() => {
      if (this.isBuffering) {
        console.warn('⚠️ BUFFER_MANAGER: Buffer timeout reached, forcing release');
        this.startRelease();
      }
    }, this.bufferTimeout);
  }

  /**
   * Stop buffering and start releasing chunks
   */
  startRelease() {
    if (this.isReleasing) return;
    
    console.log(`🎵 BUFFER_MANAGER: Starting buffer release (${this.audioBuffer.length} chunks)`);
    this.isBuffering = false;
    this.isReleasing = true;
    
    // Start releasing chunks gradually
    this.releaseChunks();
  }

  /**
   * Release buffered chunks gradually
   */
  async releaseChunks() {
    while (this.audioBuffer.length > 0 && this.isReleasing) {
      const chunk = this.audioBuffer.shift();
      
      if (chunk && this.releaseCallback) {
        try {
          // Calculate processing latency
          const latency = Date.now() - chunk.timestamp;
          this.metrics.processingLatency = latency;
          
          // Release the chunk
          await this.releaseCallback(chunk.data, chunk.metadata);
          
          console.log(`🎵 BUFFER_MANAGER: Released chunk (${this.audioBuffer.length} remaining, ${latency}ms latency)`);
          
          // Small delay between releases for smooth playback
          if (this.audioBuffer.length > 0) {
            await new Promise(resolve => setTimeout(resolve, this.chunkDelay));
          }
        } catch (error) {
          console.error('❌ BUFFER_MANAGER: Error releasing chunk:', error);
        }
      }
    }
    
    this.isReleasing = false;
    console.log('✅ BUFFER_MANAGER: Buffer release completed');
  }

  /**
   * Set callback function for releasing chunks
   */
  setReleaseCallback(callback) {
    this.releaseCallback = callback;
  }

  /**
   * Force immediate release of all buffered chunks
   */
  async forceRelease() {
    console.log('🚨 BUFFER_MANAGER: Force releasing all buffered chunks');
    this.isBuffering = false;
    
    if (!this.isReleasing) {
      this.startRelease();
    }
  }

  /**
   * Clear all buffered chunks
   */
  clearBuffer() {
    const clearedCount = this.audioBuffer.length;
    this.audioBuffer = [];
    this.isBuffering = false;
    this.isReleasing = false;
    this.totalBytesBuffered = 0;
    
    console.log(`🗑️ BUFFER_MANAGER: Cleared ${clearedCount} buffered chunks`);
  }

  /**
   * Update performance metrics
   */
  updateMetrics() {
    const now = Date.now();
    
    // Calculate average chunk size
    if (this.totalChunksProcessed > 0) {
      this.metrics.averageChunkSize = this.totalBytesBuffered / this.totalChunksProcessed;
    }
    
    // Calculate buffer utilization
    this.metrics.bufferUtilization = (this.audioBuffer.length / this.maxBufferSize) * 100;
    
    this.metrics.lastUpdateTime = now;
  }

  /**
   * Get current buffer status
   */
  getStatus() {
    return {
      bufferSize: this.audioBuffer.length,
      maxBufferSize: this.maxBufferSize,
      isBuffering: this.isBuffering,
      isReleasing: this.isReleasing,
      totalBytesBuffered: this.totalBytesBuffered,
      totalChunksProcessed: this.totalChunksProcessed,
      droppedChunks: this.droppedChunks,
      metrics: this.metrics,
      bufferAge: this.bufferStartTime ? Date.now() - this.bufferStartTime : 0
    };
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      bufferEfficiency: this.totalChunksProcessed > 0 ? 
        ((this.totalChunksProcessed - this.droppedChunks) / this.totalChunksProcessed) * 100 : 100,
      averageLatency: this.metrics.processingLatency,
      bufferUtilization: this.metrics.bufferUtilization
    };
  }

  /**
   * Optimize buffer settings based on performance
   */
  optimizeSettings() {
    const metrics = this.getMetrics();
    
    // Adjust buffer size based on drop rate
    if (metrics.bufferEfficiency < 95 && this.maxBufferSize < 100) {
      this.maxBufferSize += 10;
      console.log(`📈 BUFFER_MANAGER: Increased buffer size to ${this.maxBufferSize}`);
    } else if (metrics.bufferEfficiency > 99 && this.maxBufferSize > 20) {
      this.maxBufferSize -= 5;
      console.log(`📉 BUFFER_MANAGER: Decreased buffer size to ${this.maxBufferSize}`);
    }
    
    // Adjust chunk delay based on latency
    if (metrics.averageLatency > 100 && this.chunkDelay > 10) {
      this.chunkDelay -= 5;
      console.log(`⚡ BUFFER_MANAGER: Decreased chunk delay to ${this.chunkDelay}ms`);
    } else if (metrics.averageLatency < 50 && this.chunkDelay < 50) {
      this.chunkDelay += 5;
      console.log(`🐌 BUFFER_MANAGER: Increased chunk delay to ${this.chunkDelay}ms`);
    }
  }

  /**
   * Reset all statistics
   */
  resetStats() {
    this.totalBytesBuffered = 0;
    this.totalChunksProcessed = 0;
    this.droppedChunks = 0;
    this.metrics = {
      averageChunkSize: 0,
      bufferUtilization: 0,
      processingLatency: 0,
      lastUpdateTime: Date.now()
    };
    
    console.log('🔄 BUFFER_MANAGER: Statistics reset');
  }
}

export { BufferManager };