[18:06:38] 🔇 SILENCE_CHECK: 1000ms of silence
📨 Message string: {"type":"UserStartedSpeaking"}
[18:06:39] 🎯 DEEPGRAM: UserStartedSpeaking
[18:06:39] 🎤 USER_STARTED_SPEAKING: User began speaking
[18:06:39] 🔄 BARGE_IN: Cleared Twilio audio queue for user speech
[18:06:39] 🔄 BARGE_IN: Cleared local audio buffer and stopped streaming
[18:06:39] 🔄 SILENCE_RESET: User speaking, silence tracking reset
📨 Message string: {"type":"ConversationText","role":"user","content":"They want"}
[18:06:39] 🎯 DEEPGRAM: ConversationText
[18:06:39] 💭 CONVERSATION_TEXT: They want
📨 Message string: {"type":"History","role":"user","content":"They want"}
[18:06:39] 🎯 DEEPGRAM: History
[18:06:39] 📜 HISTORY: Message logged
[18:06:39] 🔍 History role: 'user' -> Speaker: 'User'
📝 TRANSCRIPT: Added User: They want
📨 Message string: {"type":"ConversationText","role":"assistant","content":"Could you please clarify the time you'd like to book your haircut appointment, Marco?"}
[18:06:41] 🎯 DEEPGRAM: ConversationText
[18:06:41] 💭 CONVERSATION_TEXT: Could you please clarify the time you'd like to book your haircut appointment, Marco?
📨 Message string: {"type":"History","role":"assistant","content":"Could you please clarify the time you'd like to book your haircut appointment, Marco?"}
[18:06:41] 🎯 DEEPGRAM: History
[18:06:41] 📜 HISTORY: Message logged
[18:06:41] 🔍 History role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Added AI: Could you please clarify the time you'd like to book your haircut appointment, Marco?
[18:06:41] 🎵 Starting audio stream - feeding buffer
[18:06:41] 💓 KEEPALIVE: Sent to Deepgram
📨 Message string: {"type":"UserStartedSpeaking"}
[18:06:41] 🎯 DEEPGRAM: UserStartedSpeaking
[18:06:41] 🎤 USER_STARTED_SPEAKING: User began speaking
[18:06:41] 🔄 BARGE_IN: Cleared Twilio audio queue for user speech
[18:06:41] 🔄 BARGE_IN: Cleared local audio buffer and stopped streaming
[18:06:41] 🔄 SILENCE_RESET: User speaking, silence tracking reset
📨 Message string: {"type":"AgentAudioDone"}
[18:06:41] 🎯 DEEPGRAM: AgentAudioDone
[18:06:41] 🔇 AGENT_AUDIO_DONE: AI finished sending audio
[18:06:41] 🔇 SILENCE: Started tracking
[18:06:41] ✅ Agent speech ended. Pacer will now send silence until next utterance.
📨 Message string: {"type":"ConversationText","role":"user","content":"I want for today at one."}
[18:06:42] 🎯 DEEPGRAM: ConversationText
[18:06:42] 💭 CONVERSATION_TEXT: I want for today at one.
📨 Message string: {"type":"History","role":"user","content":"I want for today at one."}
[18:06:42] 🎯 DEEPGRAM: History
[18:06:42] 📜 HISTORY: Message logged
[18:06:42] 🔍 History role: 'user' -> Speaker: 'User'
📝 TRANSCRIPT: Added User: I want for today at one.
[18:06:41] 🔇 SILENCE_CHECK: 1000ms of silence
📨 Message string: {"type":"FunctionCallRequest","functions":[{"id":"call_uaHk7ZI9wQrDoUaCy2WsFou9","name":"get_day_of_week","arguments":"{\"date\":\"18/09/2025\"}","client_side":true}]}
[18:06:43] 🎯 DEEPGRAM: FunctionCallRequest
[18:06:43] 🚨🚨 FUNCTION_CALL_REQUEST DETECTED! 🚨🚨
[18:06:43] ✅ SUCCESS: AI requesting function calls!
[18:06:43] 🕐 TIMING: Function call request received at 18:06:43
[18:06:43] 📊 FUNCTION COUNT: 1 functions in request
[18:06:43] 📋 Functions: [
  {
    "id": "call_uaHk7ZI9wQrDoUaCy2WsFou9",
    "name": "get_day_of_week",
    "arguments": "{\"date\":\"18/09/2025\"}",
    "client_side": true
  }
]
[18:06:43] 🔍 FUNCTION 1:
[18:06:43]   - Name: get_day_of_week
[18:06:43]   - ID: call_uaHk7ZI9wQrDoUaCy2WsFou9
[18:06:43]   - Arguments: {"date":"18/09/2025"}
[18:06:43] ⏸️ SILENCE: Pausing timer - Processing function calls
[18:06:43] ⏸️ KEEPALIVE: Paused for function processing
[18:06:43] 🔧 Processing function: get_day_of_week
[18:06:43] 🆔 Function ID: call_uaHk7ZI9wQrDoUaCy2WsFou9
[18:06:43] 📝 Function arguments: {"date":"18/09/2025"}
[18:06:43] 📦 Created function call data: {
  "function_name": "get_day_of_week",
  "function_call_id": "call_uaHk7ZI9wQrDoUaCy2WsFou9",
  "parameters": {
    "date": "18/09/2025"
  }
}
[18:06:43] 🔧 CALLING: handleFunctionCall for get_day_of_week with ID call_uaHk7ZI9wQrDoUaCy2WsFou9...
📝 Session updated for call CA02ba8dc1f7edd12a63af55aea1bdfacb: { callerPhone: '+447468306825' }
[18:06:43] 🚀 FUNCTION: get_day_of_week
📅 Function call data: {
  "function_name": "get_day_of_week",
  "function_call_id": "call_uaHk7ZI9wQrDoUaCy2WsFou9",
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
📨 Message string: {"type":"History","function_calls":[{"id":"call_uaHk7ZI9wQrDoUaCy2WsFou9","name":"get_day_of_week","client_side":true,"arguments":"{\"date\":\"18/09/2025\"}","response":"{\"date\":\"18/09/2025\",\"day_of_week\":\"Thursday\",\"day_number\":4,\"formatted\":\"Thursday, 18 September 2025\"}"}]}
[18:06:43] 🎯 DEEPGRAM: History
[18:06:43] 📜 HISTORY: Message logged
[18:06:43] ✅ COMPLETED: handleFunctionCall for get_day_of_week with ID call_uaHk7ZI9wQrDoUaCy2WsFou9 (took 1001ms)
[18:06:44] ▶️ KEEPALIVE: Resumed after function processing
[18:06:43] ▶️ SILENCE: Resuming timer - Function processing completed
📨 Message string: {"type":"FunctionCallRequest","functions":[{"id":"call_AnrUuDJjxwZ4coXPpFcZjn0g","name":"get_available_slots","arguments":"{\"date\":\"2025-09-18\",\"service_id\":\"haircut\"}","client_side":true}]}
[18:06:44] 🎯 DEEPGRAM: FunctionCallRequest
[18:06:44] 🚨🚨 FUNCTION_CALL_REQUEST DETECTED! 🚨🚨
[18:06:44] ✅ SUCCESS: AI requesting function calls!
[18:06:44] 🕐 TIMING: Function call request received at 18:06:44
[18:06:44] 📊 FUNCTION COUNT: 1 functions in request
[18:06:44] 📋 Functions: [
  {
    "id": "call_AnrUuDJjxwZ4coXPpFcZjn0g",
    "name": "get_available_slots",
    "arguments": "{\"date\":\"2025-09-18\",\"service_id\":\"haircut\"}",
    "client_side": true
  }
]
[18:06:44] 🔍 FUNCTION 1:
[18:06:44]   - Name: get_available_slots
[18:06:44]   - ID: call_AnrUuDJjxwZ4coXPpFcZjn0g
[18:06:44]   - Arguments: {"date":"2025-09-18","service_id":"haircut"}
[18:06:44] ⏸️ SILENCE: Pausing timer - Processing function calls
[18:06:44] ⏸️ KEEPALIVE: Paused for function processing
[18:06:44] 🔧 Processing function: get_available_slots
[18:06:44] 🆔 Function ID: call_AnrUuDJjxwZ4coXPpFcZjn0g
[18:06:44] 📝 Function arguments: {"date":"2025-09-18","service_id":"haircut"}
[18:06:44] 📦 Created function call data: {
  "function_name": "get_available_slots",
  "function_call_id": "call_AnrUuDJjxwZ4coXPpFcZjn0g",
  "parameters": {
    "date": "2025-09-18",
    "service_id": "haircut"
  }
}
[18:06:44] 🔧 CALLING: handleFunctionCall for get_available_slots with ID call_AnrUuDJjxwZ4coXPpFcZjn0g...
📝 Session updated for call CA02ba8dc1f7edd12a63af55aea1bdfacb: { callerPhone: '+447468306825' }
[18:06:44] 🚀 FUNCTION: get_available_slots
[18:06:44] 🗓️ GET_SLOTS: 2025-09-18 service:haircut
📅 Business open on Thursday
📋 Found service by name 'haircut' -> ID: 89f199c8-c4ee-4f42-91a7-1f8bd70cff4a
📋 Using service: haircut (Duration: 30 minutes)
[18:06:44] 📡 API: 200 - 28 slots
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
📝 Session updated for call CA02ba8dc1f7edd12a63af55aea1bdfacb: {
  callerPhone: '+447468306825',
  lastCheckedDate: '2025-09-18',
  lastCheckedTimestamp: '18:06:47'
}
📅 Stored checked date in session: 2025-09-18
✅ Sending get_available_slots response to Deepgram
✅ Function response sent successfully to Deepgram
🔄 Waiting for Deepgram to process the response...
📨 Message string: {"type":"History","function_calls":[{"id":"call_AnrUuDJjxwZ4coXPpFcZjn0g","name":"get_available_slots","client_side":true,"arguments":"{\"date\":\"2025-09-18\",\"service_id\":\"haircut\"}","response":"{\"available_slots\":[\"09:00\",\"09:15\",\"09:30\",\"09:45\",\"10:00\",\"10:15\",\"10:30\",\"10:45\",\"11:00\",\"11:15\",\"11:30\",\"12:30\",\"12:45\",\"13:00\",\"13:15\",\"13:30\",\"13:45\",\"14:00\",\"14:15\",\"14:30\",\"14:45\",\"15:00\",\"15:15\",\"15:30\",\"15:45\",\"16:00\",\"16:15\",\"16:30\"]}"}]}
[18:06:47] 🎯 DEEPGRAM: History
[18:06:47] 📜 HISTORY: Message logged
📨 Message string: {"type":"ConversationText","role":"assistant","content":"Perfect!"}
[18:06:48] 🎯 DEEPGRAM: ConversationText
[18:06:48] 💭 CONVERSATION_TEXT: Perfect!
📨 Message string: {"type":"History","role":"assistant","content":"Perfect!"}
[18:06:48] 🎯 DEEPGRAM: History
[18:06:48] 📜 HISTORY: Message logged
[18:06:48] 🔍 History role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Added AI: Perfect!
[18:06:48] 🎵 Starting audio stream - feeding buffer
[18:06:44] ✅ COMPLETED: handleFunctionCall for get_available_slots with ID call_AnrUuDJjxwZ4coXPpFcZjn0g (took 3765ms)
[18:06:48] ▶️ KEEPALIVE: Resumed after function processing
[18:06:44] ▶️ SILENCE: Resuming timer - Function processing completed
[18:06:48] 🔇 Audio stream ended (timeout)
📨 Message string: {"type":"ConversationText","role":"assistant","content":"I can book you for 1 PM today, Thursday the 18th."}
[18:06:49] 🎯 DEEPGRAM: ConversationText
[18:06:49] 💭 CONVERSATION_TEXT: I can book you for 1 PM today, Thursday the 18th.
📨 Message string: {"type":"History","role":"assistant","content":"I can book you for 1 PM today, Thursday the 18th."}
[18:06:49] 🎯 DEEPGRAM: History