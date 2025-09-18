[17:51:01] 🔄 SILENCE_RESET: User speaking, silence tracking reset
📨 Message string: {"type":"ConversationText","role":"user","content":"I want to book it for today at one."}
[17:51:03] 🎯 DEEPGRAM: ConversationText
[17:51:03] 💭 CONVERSATION_TEXT: I want to book it for today at one.
📨 Message string: {"type":"History","role":"user","content":"I want to book it for today at one."}
[17:51:03] 🎯 DEEPGRAM: History
[17:51:03] 📜 HISTORY: Message logged
[17:51:03] 🔍 History role: 'user' -> Speaker: 'User'
📝 TRANSCRIPT: Added User: I want to book it for today at one.
[17:51:03] 💓 KEEPALIVE: Sent to Deepgram
📨 Message string: {"type":"FunctionCallRequest","functions":[{"id":"call_fvPBpCuc1C9Ilr9RHh2rGWns","name":"get_day_of_week","arguments":"{\"date\":\"18/09/2025\"}","client_side":true}]}
[17:51:03] 🎯 DEEPGRAM: FunctionCallRequest
[17:51:03] 🚨🚨 FUNCTION_CALL_REQUEST DETECTED! 🚨🚨
[17:51:03] ✅ SUCCESS: AI requesting function calls!
[17:51:03] 🕐 TIMING: Function call request received at 17:51:03
[17:51:03] 📊 FUNCTION COUNT: 1 functions in request
[17:51:03] 📋 Functions: [
  {
    "id": "call_fvPBpCuc1C9Ilr9RHh2rGWns",
    "name": "get_day_of_week",
    "arguments": "{\"date\":\"18/09/2025\"}",
    "client_side": true
  }
]
[17:51:03] 🔍 FUNCTION 1:
[17:51:03]   - Name: get_day_of_week
[17:51:03]   - ID: call_fvPBpCuc1C9Ilr9RHh2rGWns
[17:51:03]   - Arguments: {"date":"18/09/2025"}
[17:51:03] ⏸️ SILENCE: Pausing timer - Processing function calls
[17:51:03] ⏸️ KEEPALIVE: Paused for function processing
[17:51:03] 🔧 Processing function: get_day_of_week
[17:51:03] 🆔 Function ID: call_fvPBpCuc1C9Ilr9RHh2rGWns
[17:51:03] 📝 Function arguments: {"date":"18/09/2025"}
[17:51:03] 📦 Created function call data: {
  "function_name": "get_day_of_week",
  "function_call_id": "call_fvPBpCuc1C9Ilr9RHh2rGWns",
  "parameters": {
    "date": "18/09/2025"
  }
}
[17:51:03] 🔧 CALLING: handleFunctionCall for get_day_of_week with ID call_fvPBpCuc1C9Ilr9RHh2rGWns...
📝 Session updated for call CA6e4194411af41df07ac3df937bc390e1: { callerPhone: '+447468306825' }
[17:51:03] 🚀 FUNCTION: get_day_of_week
📅 Function call data: {
  "function_name": "get_day_of_week",
  "function_call_id": "call_fvPBpCuc1C9Ilr9RHh2rGWns",
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
📨 Message string: {"type":"History","function_calls":[{"id":"call_fvPBpCuc1C9Ilr9RHh2rGWns","name":"get_day_of_week","client_side":true,"arguments":"{\"date\":\"18/09/2025\"}","response":"{\"date\":\"18/09/2025\",\"day_of_week\":\"Thursday\",\"day_number\":4,\"formatted\":\"Thursday, 18 September 2025\"}"}]}
[17:51:04] 🎯 DEEPGRAM: History
[17:51:04] 📜 HISTORY: Message logged
[17:51:03] ✅ COMPLETED: handleFunctionCall for get_day_of_week with ID call_fvPBpCuc1C9Ilr9RHh2rGWns (took 1003ms)
[17:51:04] ▶️ KEEPALIVE: Resumed after function processing
[17:51:03] ▶️ SILENCE: Resuming timer - Function processing completed
📨 Message string: {"type":"FunctionCallRequest","functions":[{"id":"call_JKQG7Jyn7nwTsZpj62qYv85V","name":"get_available_slots","arguments":"{\"date\":\"2025-09-18\",\"service_id\":\"haircut\"}","client_side":true}]}
[17:51:05] 🎯 DEEPGRAM: FunctionCallRequest
[17:51:05] 🚨🚨 FUNCTION_CALL_REQUEST DETECTED! 🚨🚨
[17:51:05] ✅ SUCCESS: AI requesting function calls!
[17:51:05] 🕐 TIMING: Function call request received at 17:51:05
[17:51:05] 📊 FUNCTION COUNT: 1 functions in request
[17:51:05] 📋 Functions: [
  {
    "id": "call_JKQG7Jyn7nwTsZpj62qYv85V",
    "name": "get_available_slots",
    "arguments": "{\"date\":\"2025-09-18\",\"service_id\":\"haircut\"}",
    "client_side": true
  }
]
[17:51:05] 🔍 FUNCTION 1:
[17:51:05]   - Name: get_available_slots
[17:51:05]   - ID: call_JKQG7Jyn7nwTsZpj62qYv85V
[17:51:05]   - Arguments: {"date":"2025-09-18","service_id":"haircut"}
[17:51:05] ⏸️ SILENCE: Pausing timer - Processing function calls
[17:51:05] ⏸️ KEEPALIVE: Paused for function processing
[17:51:05] 🔧 Processing function: get_available_slots
[17:51:05] 🆔 Function ID: call_JKQG7Jyn7nwTsZpj62qYv85V
[17:51:05] 📝 Function arguments: {"date":"2025-09-18","service_id":"haircut"}
[17:51:05] 📦 Created function call data: {
  "function_name": "get_available_slots",
  "function_call_id": "call_JKQG7Jyn7nwTsZpj62qYv85V",
  "parameters": {
    "date": "2025-09-18",
    "service_id": "haircut"
  }
}
[17:51:05] 🔧 CALLING: handleFunctionCall for get_available_slots with ID call_JKQG7Jyn7nwTsZpj62qYv85V...
📝 Session updated for call CA6e4194411af41df07ac3df937bc390e1: { callerPhone: '+447468306825' }
[17:51:05] 🚀 FUNCTION: get_available_slots
[17:51:05] 🗓️ GET_SLOTS: 2025-09-18 service:haircut
📅 Business open on Thursday
📋 Found service by name 'haircut' -> ID: 89f199c8-c4ee-4f42-91a7-1f8bd70cff4a
📋 Using service: haircut (Duration: 30 minutes)
[17:51:05] 📡 API: 200 - 28 slots
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
📝 Session updated for call CA6e4194411af41df07ac3df937bc390e1: {
  callerPhone: '+447468306825',
  lastCheckedDate: '2025-09-18',
  lastCheckedTimestamp: '17:51:07'
}
📅 Stored checked date in session: 2025-09-18
✅ Sending get_available_slots response to Deepgram
✅ Function response sent successfully to Deepgram
🔄 Waiting for Deepgram to process the response...
📨 Message string: {"type":"History","function_calls":[{"id":"call_JKQG7Jyn7nwTsZpj62qYv85V","name":"get_available_slots","client_side":true,"arguments":"{\"date\":\"2025-09-18\",\"service_id\":\"haircut\"}","response":"{\"available_slots\":[\"09:00\",\"09:15\",\"09:30\",\"09:45\",\"10:00\",\"10:15\",\"10:30\",\"10:45\",\"11:00\",\"11:15\",\"11:30\",\"12:30\",\"12:45\",\"13:00\",\"13:15\",\"13:30\",\"13:45\",\"14:00\",\"14:15\",\"14:30\",\"14:45\",\"15:00\",\"15:15\",\"15:30\",\"15:45\",\"16:00\",\"16:15\",\"16:30\"]}"}]}
[17:51:07] 🎯 DEEPGRAM: History
[17:51:07] 📜 HISTORY: Message logged
[17:51:05] ✅ COMPLETED: handleFunctionCall for get_available_slots with ID call_JKQG7Jyn7nwTsZpj62qYv85V (took 3019ms)
[17:51:08] ▶️ KEEPALIVE: Resumed after function processing
[17:51:05] ▶️ SILENCE: Resuming timer - Function processing completed
📨 Message string: {"type":"ConversationText","role":"assistant","content":"Perfect, Marco!"}
[17:51:08] 🎯 DEEPGRAM: ConversationText
[17:51:08] 💭 CONVERSATION_TEXT: Perfect, Marco!
📨 Message string: {"type":"History","role":"assistant","content":"Perfect, Marco!"}
[17:51:08] 🎯 DEEPGRAM: History
[17:51:08] 📜 HISTORY: Message logged
[17:51:08] 🔍 History role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Added AI: Perfect, Marco!
[17:51:08] 🎵 Starting audio stream - feeding buffer
[17:51:09] 🔇 Audio stream ended (timeout)
📨 Message string: {"type":"ConversationText","role":"assistant","content":"I can book your haircut for today at 1 PM."}
[17:51:09] 🎯 DEEPGRAM: ConversationText
[17:51:09] 💭 CONVERSATION_TEXT: I can book your haircut for today at 1 PM.
📨 Message string: {"type":"History","role":"assistant","content":"I can book your haircut for today at 1 PM."}
[17:51:10] 🎯 DEEPGRAM: History
[17:51:10] 📜 HISTORY: Message logged
[17:51:10] 🔍 History role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Added AI: I can book your haircut for today at 1 PM.
[17:51:10] 🎵 Starting audio stream - feeding buffer
[17:51:10] 🔇 Audio stream ended (timeout)
[17:51:11] 💓 KEEPALIVE: Sent to Deepgram
📨 Message string: {"type":"ConversationText","role":"assistant","content":"Shall I confirm that for you?"}
[17:51:12] 🎯 DEEPGRAM: ConversationText
[17:51:12] 💭 CONVERSATION_TEXT: Shall I confirm that for you?
📨 Message string: {"type":"History","role":"assistant","content":"Shall I confirm that for you?"}
[17:51:12] 🎯 DEEPGRAM: History
[17:51:12] 📜 HISTORY: Message logged
[17:51:12] 🔍 History role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Added AI: Shall I confirm that for you?
[17:51:12] 🎵 Starting audio stream - feeding buffer
📨 Message string: {"type":"AgentAudioDone"}
[17:51:12] 🎯 DEEPGRAM: AgentAudioDone
[17:51:12] 🔇 AGENT_AUDIO_DONE: AI finished sending audio
[17:51:12] 🔇 SILENCE: Started tracking
[17:51:12] ✅ Agent speech ended. Pacer will now send silence until next utterance.
[17:51:12] 🔇 SILENCE_CHECK: 1000ms of silence
[17:51:12] 🔇 SILENCE_CHECK: 2000ms of silence
📨 Message string: {"type":"UserStartedSpeaking"}
[17:51:15] 🎯 DEEPGRAM: UserStartedSpeaking
[17:51:15] 🎤 USER_STARTED_SPEAKING: User began speaking
[17:51:15] 🔄 BARGE_IN: Cleared Twilio audio queue for user speech
[17:51:15] 🔄 BARGE_IN: Cleared local audio buffer and stopped streaming
[17:51:15] 🔄 SILENCE_RESET: User speaking, silence tracking reset
[17:51:15] 💓 KEEPALIVE: Sent to Deepgram
📨 Message string: {"type":"ConversationText","role":"user","content":"Yes."}
[17:51:15] 🎯 DEEPGRAM: ConversationText
[17:51:15] 💭 CONVERSATION_TEXT: Yes.
📨 Message string: {"type":"History","role":"user","content":"Yes."}
[17:51:15] 🎯 DEEPGRAM: History
[17:51:15] 📜 HISTORY: Message logged
[17:51:15] 🔍 History role: 'user' -> Speaker: 'User'
📝 TRANSCRIPT: Added User: Yes.
📨 Message string: {"type":"FunctionCallRequest","functions":[{"id":"call_cp4nlYFvSTuOCosyUFEvnOZB","name":"create_booking","arguments":"{\"customer_name\":\"Marco\",\"date\":\"2025-09-18\",\"service_id\":\"haircut\",\"time\":\"13:00\"}","client_side":true}]}
[17:51:17] 🎯 DEEPGRAM: FunctionCallRequest
[17:51:17] 🚨🚨 FUNCTION_CALL_REQUEST DETECTED! 🚨🚨
[17:51:17] ✅ SUCCESS: AI requesting function calls!
[17:51:17] 🕐 TIMING: Function call request received at 17:51:17
[17:51:17] 📊 FUNCTION COUNT: 1 functions in request
[17:51:17] 📋 Functions: [
  {
    "id": "call_cp4nlYFvSTuOCosyUFEvnOZB",
    "name": "create_booking",
    "arguments": "{\"customer_name\":\"Marco\",\"date\":\"2025-09-18\",\"service_id\":\"haircut\",\"time\":\"13:00\"}",
    "client_side": true
  }
]
[17:51:17] 🔍 FUNCTION 1:
[17:51:17]   - Name: create_booking
[17:51:17]   - ID: call_cp4nlYFvSTuOCosyUFEvnOZB
[17:51:17]   - Arguments: {"customer_name":"Marco","date":"2025-09-18","service_id":"haircut","time":"13:00"}
[17:51:17] ⏸️ SILENCE: Pausing timer - Processing function calls
[17:51:17] ⏸️ KEEPALIVE: Paused for function processing
[17:51:17] 🔧 Processing function: create_booking
[17:51:17] 🆔 Function ID: call_cp4nlYFvSTuOCosyUFEvnOZB
[17:51:17] 📝 Function arguments: {"customer_name":"Marco","date":"2025-09-18","service_id":"haircut","time":"13:00"}
[17:51:17] 📦 Created function call data: {
  "function_name": "create_booking",
  "function_call_id": "call_cp4nlYFvSTuOCosyUFEvnOZB",
  "parameters": {
    "customer_name": "Marco",
    "date": "2025-09-18",
    "service_id": "haircut",
    "time": "13:00"
  }
}
[17:51:17] 🔧 CALLING: handleFunctionCall for create_booking with ID call_cp4nlYFvSTuOCosyUFEvnOZB...
📝 Session updated for call CA6e4194411af41df07ac3df937bc390e1: {
  callerPhone: '+447468306825',
  lastCheckedDate: '2025-09-18',
  lastCheckedTimestamp: '17:51:07'
}
[17:51:17] 🚀 FUNCTION: create_booking
🔍 DEDUP CHECK: Checking function call ID call_cp4nlYFvSTuOCosyUFEvnOZB
🔍 DEDUP CHECK: Current processed calls: []
🔍 DEDUP CHECK: Function parameters: {
  "customer_name": "Marco",
  "date": "2025-09-18",
  "service_id": "haircut",
  "time": "13:00"
}
🔍 DEDUP CHECK: Timestamp: 17:51:17
✅ TRACKING: Added function call ID call_cp4nlYFvSTuOCosyUFEvnOZB to processed set
✅ TRACKING: Updated processed calls: [ 'call_cp4nlYFvSTuOCosyUFEvnOZB' ]
❌ FUNCTION_CALL_BLOCKED: Cannot book appointments in the past. Current time: 2025-09-18 17:51 (Europe/London)
[17:51:17] ✅ COMPLETED: handleFunctionCall for create_booking with ID call_cp4nlYFvSTuOCosyUFEvnOZB (took 1ms)
[17:51:17] ▶️ KEEPALIVE: Resumed after function processing
[17:51:17] ▶️ SILENCE: Resuming timer - Function processing completed
[17:51:19] 💓 KEEPALIVE: Sent to Deepgram
[17:51:23] 💓 KEEPALIVE: Sent to Deepgram
[17:51:27] 💓 KEEPALIVE: Sent to Deepgram
[17:51:31] 💓 KEEPALIVE: Sent to Deepgram
📨 Message string: {"type":"UserStartedSpeaking"}
[17:51:32] 🎯 DEEPGRAM: UserStartedSpeaking
[17:51:32] 🎤 USER_STARTED_SPEAKING: User began speaking
[17:51:32] 🔄 BARGE_IN: Cleared Twilio audio queue for user speech
[17:51:32] 🔄 BARGE_IN: Cleared local audio buffer and stopped streaming
[17:51:32] 🔄 SILENCE_RESET: User speaking, silence tracking reset
📨 Message string: {"type":"ConversationText","role":"user","content":"Hello?"}
[17:51:35] 🎯 DEEPGRAM: ConversationText
[17:51:35] 💭 CONVERSATION_TEXT: Hello?
📨 Message string: {"type":"History","role":"user","content":"Hello?"}
[17:51:35] 🎯 DEEPGRAM: History
[17:51:35] 📜 HISTORY: Message logged