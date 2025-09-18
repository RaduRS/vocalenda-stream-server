ur haircut?
[17:57:01] 🎵 Starting audio stream - feeding buffer
📨 Message string: {"type":"AgentAudioDone"}
[17:57:02] 🎯 DEEPGRAM: AgentAudioDone
[17:57:02] 🔇 AGENT_AUDIO_DONE: AI finished sending audio
[17:57:02] 🔇 SILENCE: Started tracking
[17:57:02] ✅ Agent speech ended. Pacer will now send silence until next utterance.
[17:57:02] 🔇 SILENCE_CHECK: 1000ms of silence
[17:57:03] 💓 KEEPALIVE: Sent to Deepgram
[17:57:02] 🔇 SILENCE_CHECK: 2000ms of silence
[17:57:02] 🔇 SILENCE_CHECK: 3000ms of silence
📨 Message string: {"type":"UserStartedSpeaking"}
[17:57:06] 🎯 DEEPGRAM: UserStartedSpeaking
[17:57:06] 🎤 USER_STARTED_SPEAKING: User began speaking
[17:57:06] 🔄 BARGE_IN: Cleared Twilio audio queue for user speech
[17:57:06] 🔄 BARGE_IN: Cleared local audio buffer and stopped streaming
[17:57:06] 🔄 SILENCE_RESET: User speaking, silence tracking reset
📨 Message string: {"type":"ConversationText","role":"user","content":"I want today at one."}
[17:57:07] 🎯 DEEPGRAM: ConversationText
[17:57:07] 💭 CONVERSATION_TEXT: I want today at one.
📨 Message string: {"type":"History","role":"user","content":"I want today at one."}
[17:57:07] 🎯 DEEPGRAM: History
[17:57:07] 📜 HISTORY: Message logged
[17:57:07] 🔍 History role: 'user' -> Speaker: 'User'
📝 TRANSCRIPT: Added User: I want today at one.
[17:57:07] 💓 KEEPALIVE: Sent to Deepgram
📨 Message string: {"type":"ConversationText","role":"assistant","content":"Let me quickly check the available slots for today, Thursday, the 18th of September."}
[17:57:08] 🎯 DEEPGRAM: ConversationText
[17:57:08] 💭 CONVERSATION_TEXT: Let me quickly check the available slots for today, Thursday, the 18th of September.
📨 Message string: {"type":"History","role":"assistant","content":"Let me quickly check the available slots for today, Thursday, the 18th of September."}
[17:57:08] 🎯 DEEPGRAM: History
[17:57:08] 📜 HISTORY: Message logged
[17:57:08] 🔍 History role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Added AI: Let me quickly check the available slots for today, Thursday, the 18th of September.
[17:57:08] 🎵 Starting audio stream - feeding buffer
📨 Message string: {"type":"FunctionCallRequest","functions":[{"id":"call_fq7NhvqceTkDqYhkxT4ugoDS","name":"get_available_slots","arguments":"{\"date\":\"2025-09-18\"}","client_side":true}]}
[17:57:09] 🎯 DEEPGRAM: FunctionCallRequest
[17:57:09] 🚨🚨 FUNCTION_CALL_REQUEST DETECTED! 🚨🚨
[17:57:09] ✅ SUCCESS: AI requesting function calls!
[17:57:09] 🕐 TIMING: Function call request received at 17:57:09
[17:57:09] 📊 FUNCTION COUNT: 1 functions in request
[17:57:09] 📋 Functions: [
  {
    "id": "call_fq7NhvqceTkDqYhkxT4ugoDS",
    "name": "get_available_slots",
    "arguments": "{\"date\":\"2025-09-18\"}",
    "client_side": true
  }
]
[17:57:09] 🔍 FUNCTION 1:
[17:57:09]   - Name: get_available_slots
[17:57:09]   - ID: call_fq7NhvqceTkDqYhkxT4ugoDS
[17:57:09]   - Arguments: {"date":"2025-09-18"}
[17:57:09] ⏸️ SILENCE: Pausing timer - Processing function calls
[17:57:09] ⏸️ KEEPALIVE: Paused for function processing
[17:57:09] 🔧 Processing function: get_available_slots
[17:57:09] 🆔 Function ID: call_fq7NhvqceTkDqYhkxT4ugoDS
[17:57:09] 📝 Function arguments: {"date":"2025-09-18"}
[17:57:09] 📦 Created function call data: {
  "function_name": "get_available_slots",
  "function_call_id": "call_fq7NhvqceTkDqYhkxT4ugoDS",
  "parameters": {
    "date": "2025-09-18"
  }
}
[17:57:09] 🔧 CALLING: handleFunctionCall for get_available_slots with ID call_fq7NhvqceTkDqYhkxT4ugoDS...
📝 Session updated for call CAd1547ed9c08c215397dc44d30e918aa9: { callerPhone: '+447468306825' }
[17:57:09] 🚀 FUNCTION: get_available_slots
[17:57:09] 🗓️ GET_SLOTS: 2025-09-18 service:undefined
📅 Business open on Thursday
📋 Using default service: haircut (Duration: 30 minutes)
Shutting down server...
HTTP server closed
[17:57:10] 🔇 Audio stream ended (timeout)
[17:57:09] 📡 API: 200 - 28 slots
✅ Available time slots: [
  '09:00', '09:15', '09:30',
  '09:45', '10:00', '10:15',
  '10:30', '10:45', '11:00',
  '11:15', '11:30', '12:30',
  '12:45', '13:00', '13:15',
  '13:30', '13:45', '14:00',
  '14:15', '14:30', '14:45',
  '15:00', '15:15', '15:30',
  '15:45', '16:00', '16:15',
  '16:30'
]
📝 Session updated for call CAd1547ed9c08c215397dc44d30e918aa9: {
  callerPhone: '+447468306825',
  lastCheckedDate: '2025-09-18',
  lastCheckedTimestamp: '17:57:11'
}
📅 Stored checked date in session: 2025-09-18
✅ Sending get_available_slots response to Deepgram
✅ Function response sent successfully to Deepgram
🔄 Waiting for Deepgram to process the response...
📨 Message string: {"type":"History","function_calls":[{"id":"call_fq7NhvqceTkDqYhkxT4ugoDS","name":"get_available_slots","client_side":true,"arguments":"{\"date\": \"2025-09-18\"}","response":"{\"available_slots\":[\"09:00\",\"09:15\",\"09:30\",\"09:45\",\"10:00\",\"10:15\",\"10:30\",\"10:45\",\"11:00\",\"11:15\",\"11:30\",\"12:30\",\"12:45\",\"13:00\",\"13:15\",\"13:30\",\"13:45\",\"14:00\",\"14:15\",\"14:30\",\"14:45\",\"15:00\",\"15:15\",\"15:30\",\"15:45\",\"16:00\",\"16:15\",\"16:30\"]}"}]}
[17:57:11] 🎯 DEEPGRAM: History
[17:57:11] 📜 HISTORY: Message logged
📨 Message string: {"type":"FunctionCallRequest","functions":[{"id":"call_7z50vO9vCDPMuvsXW7WtKL3H","name":"get_day_of_week","arguments":"{\"date\":\"18/09/2025\"}","client_side":true}]}
[17:57:11] 🎯 DEEPGRAM: FunctionCallRequest
[17:57:11] 🚨🚨 FUNCTION_CALL_REQUEST DETECTED! 🚨🚨
[17:57:11] ✅ SUCCESS: AI requesting function calls!
[17:57:11] 🕐 TIMING: Function call request received at 17:57:11
[17:57:11] 📊 FUNCTION COUNT: 1 functions in request
[17:57:11] 📋 Functions: [
  {
    "id": "call_7z50vO9vCDPMuvsXW7WtKL3H",
    "name": "get_day_of_week",
    "arguments": "{\"date\":\"18/09/2025\"}",
    "client_side": true
  }
]
[17:57:11] 🔍 FUNCTION 1:
[17:57:11]   - Name: get_day_of_week
[17:57:11]   - ID: call_7z50vO9vCDPMuvsXW7WtKL3H
[17:57:11]   - Arguments: {"date":"18/09/2025"}
[17:57:11] ⏸️ SILENCE: Pausing timer - Processing function calls
[17:57:11] ⏸️ KEEPALIVE: Paused for function processing
[17:57:11] 🔧 Processing function: get_day_of_week
[17:57:11] 🆔 Function ID: call_7z50vO9vCDPMuvsXW7WtKL3H
[17:57:11] 📝 Function arguments: {"date":"18/09/2025"}
[17:57:11] 📦 Created function call data: {
  "function_name": "get_day_of_week",
  "function_call_id": "call_7z50vO9vCDPMuvsXW7WtKL3H",
  "parameters": {
    "date": "18/09/2025"
  }
}
[17:57:11] 🔧 CALLING: handleFunctionCall for get_day_of_week with ID call_7z50vO9vCDPMuvsXW7WtKL3H...
📝 Session updated for call CAd1547ed9c08c215397dc44d30e918aa9: {
  callerPhone: '+447468306825',
  lastCheckedDate: '2025-09-18',
  lastCheckedTimestamp: '17:57:11'
}
[17:57:11] 🚀 FUNCTION: get_day_of_week
📅 Function call data: {
  "function_name": "get_day_of_week",
  "function_call_id": "call_7z50vO9vCDPMuvsXW7WtKL3H",
  "parameters": {
    "date": "18/09/2025"
  }
}
📅 Extracted params: {
  "date": "18/09/2025"
}
📅 Getting day of week for: 18/09/2025
📅 Date type: string
📅 Date value: "18/09/2025"
📅 Parsed date successfully: 2025-09-18T00:00:00.000Z
✅ 18/09/2025 is a Thursday
✅ Sending get_day_of_week response to Deepgram
✅ Function response sent successfully to Deepgram
🔄 Waiting for Deepgram to process the response...
📨 Message string: {"type":"History","function_calls":[{"id":"call_7z50vO9vCDPMuvsXW7WtKL3H","name":"get_day_of_week","client_side":true,"arguments":"{\"date\": \"18/09/2025\"}","response":"{\"date\":\"18/09/2025\",\"day_of_week\":\"Thursday\",\"day_number\":4,\"formatted\":\"Thursday, 18 September 2025\"}"}]}
[17:57:11] 🎯 DEEPGRAM: History
[17:57:11] 📜 HISTORY: Message logged
[17:57:09] ✅ COMPLETED: handleFunctionCall for get_available_slots with ID call_fq7NhvqceTkDqYhkxT4ugoDS (took 3130ms)
[17:57:12] ▶️ KEEPALIVE: Resumed after function processing
[17:57:09] ▶️ SILENCE: Resuming timer - Function processing completed
[17:57:11] ✅ COMPLETED: handleFunctionCall for get_day_of_week with ID call_7z50vO9vCDPMuvsXW7WtKL3H (took 1002ms)
[17:57:12] ▶️ KEEPALIVE: Resumed after function processing
[17:57:11] ▶️ SILENCE: Resuming timer - Function processing completed
📨 Message string: {"type":"ConversationText","role":"assistant","content":"One moment please."}
[17:57:13] 🎯 DEEPGRAM: ConversationText
[17:57:13] 💭 CONVERSATION_TEXT: One moment please.
📨 Message string: {"type":"History","role":"assistant","content":"One moment please."}
[17:57:13] 🎯 DEEPGRAM: History
[17:57:13] 📜 HISTORY: Message logged
[17:57:13] 🔍 History role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Added AI: One moment please.
[17:57:13] 🎵 Starting audio stream - feeding buffer
[17:57:13] 🔇 Audio stream ended (timeout)
📨 Message string: {"type":"ConversationText","role":"assistant","content":"Today is Thursday, the 18th of September."}
[17:57:14] 🎯 DEEPGRAM: ConversationText
[17:57:14] 💭 CONVERSATION_TEXT: Today is Thursday, the 18th of September.
📨 Message string: {"type":"History","role":"assistant","content":"Today is Thursday, the 18th of September."}
[17:57:14] 🎯 DEEPGRAM: History
[17:57:14] 📜 HISTORY: Message logged
[17:57:14] 🔍 History role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Added AI: Today is Thursday, the 18th of September.
[17:57:14] 🎵 Starting audio stream - feeding buffer
[17:57:14] 🔇 Audio stream ended (timeout)
[17:57:15] 💓 KEEPALIVE: Sent to Deepgram
📨 Message string: {"type":"ConversationText","role":"assistant","content":"I see that 1 PM is available for a haircut today."}
[17:57:17] 🎯 DEEPGRAM: ConversationText
[17:57:17] 💭 CONVERSATION_TEXT: I see that 1 PM is available for a haircut today.
📨 Message string: {"type":"History","role":"assistant","content":"I see that 1 PM is available for a haircut today."}
[17:57:17] 🎯 DEEPGRAM: History
[17:57:17] 📜 HISTORY: Message logged
[17:57:17] 🔍 History role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Added AI: I see that 1 PM is available for a haircut today.
[17:57:17] 🎵 Starting audio stream - feeding buffer
[17:57:17] 🔇 Audio stream ended (timeout)
[17:57:19] 💓 KEEPALIVE: Sent to Deepgram
📨 Message string: {"type":"ConversationText","role":"assistant","content":"Perfect!"}
[17:57:21] 🎯 DEEPGRAM: ConversationText
[17:57:21] 💭 CONVERSATION_TEXT: Perfect!
📨 Message string: {"type":"History","role":"assistant","content":"Perfect!"}
[17:57:21] 🎯 DEEPGRAM: History
[17:57:21] 📜 HISTORY: Message logged
[17:57:21] 🔍 History role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Added AI: Perfect!
[17:57:21] 🎵 Starting audio stream - feeding buffer
[17:57:21] 🔇 Audio stream ended (timeout)
📨 Message string: {"type":"ConversationText","role":"assistant","content":"I can book you for 1 PM today."}
[17:57:22] 🎯 DEEPGRAM: ConversationText
[17:57:22] 💭 CONVERSATION_TEXT: I can book you for 1 PM today.
📨 Message string: {"type":"History","role":"assistant","content":"I can book you for 1 PM today."}
[17:57:22] 🎯 DEEPGRAM: History
[17:57:22] 📜 HISTORY: Message logged
[17:57:22] 🔍 History role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Added AI: I can book you for 1 PM today.
[17:57:22] 🎵 Starting audio stream - feeding buffer
[17:57:22] 🔇 Audio stream ended (timeout)
[17:57:23] 💓 KEEPALIVE: Sent to Deepgram
Media stream stopped
📞 Logging call completion: CAd1547ed9c08c215397dc44d30e918aa9
✅ Call completion logged: CAd1547ed9c08c215397dc44d30e918aa9
✅ Saved transcript for call CAd1547ed9c08c215397dc44d30e918aa9 (11 entries)
🔌 Closing Deepgram connection and cleaning up resources
🔇 Persistent pacer cleaned up
🔇 Silence tracking cleaned up
🧹 CLEANUP: Cleaning up connection state for call CAd1547ed9c08c215397dc44d30e918aa9
✅ Deepgram connection closed successfully
Deepgram WebSocket closed in initializeDeepgram. Code: 1000, Reason: Call ended
Deepgram WebSocket closed. Code: 1000, Reason: Call ended