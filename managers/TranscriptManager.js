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