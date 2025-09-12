/**
 * Transcript manager - handles conversation transcript tracking
 * Separated for better modularity and testability
 */
export class TranscriptManager {
  constructor(callSid) {
    this.conversationTranscript = [];
    this.currentCallSid = callSid;
  }
  
  addEntry(speaker, text, timestamp = new Date().toISOString()) {
    // Check for duplicate entries (same speaker, text, and within 5 seconds)
    const isDuplicate = this.conversationTranscript.some(entry => {
      if (entry.speaker === speaker && entry.text === text) {
        const entryTime = new Date(entry.timestamp).getTime();
        const currentTime = new Date(timestamp).getTime();
        const timeDiff = Math.abs(currentTime - entryTime);
        return timeDiff < 5000; // 5 seconds threshold
      }
      return false;
    });
    
    if (isDuplicate) {
      console.log(`📝 TRANSCRIPT: Skipping duplicate ${speaker}: ${text}`);
      return null;
    }
    
    const entry = { speaker, text, timestamp };
    this.conversationTranscript.push(entry);
    console.log(`📝 TRANSCRIPT: Added ${speaker}: ${text}`);
    return entry;
  }
  
  getTranscript() {
    return [...this.conversationTranscript];
  }
  
  getLastEntry() {
    return this.conversationTranscript[this.conversationTranscript.length - 1] || null;
  }
  
  getEntriesBySpeaker(speaker) {
    return this.conversationTranscript.filter(entry => entry.speaker === speaker);
  }
  
  getTranscriptText() {
    return this.conversationTranscript
      .map(entry => `${entry.speaker}: ${entry.text}`)
      .join('\n');
  }
  
  getCallSid() {
    return this.currentCallSid;
  }
  
  getEntryCount() {
    return this.conversationTranscript.length;
  }
  
  clear() {
    this.conversationTranscript = [];
  }
  
  // Export transcript for database storage
  exportForStorage() {
    return {
      callSid: this.currentCallSid,
      transcript: this.getTranscript(),
      entryCount: this.getEntryCount(),
      exportedAt: new Date().toISOString()
    };
  }
}