878Z] 🎯 DEEPGRAM EVENT TYPE: History
[2025-09-14T11:02:29.878Z] 📜 HISTORY: Message logged
[2025-09-14T11:02:29.878Z] 🔍 History role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Skipping duplicate AI: Great!
[2025-09-14T11:02:29.878Z] 📝 Added transcript: [AI] Great!
[2025-09-14T11:02:29.879Z] 🎵 Starting audio stream - feeding buffer
[2025-09-14T11:02:29.950Z] 🔇 Audio stream ended (timeout)
📨 Received Deepgram JSON message: {"type":"ConversationText","role":"assistant","content":"I will book you for a haircut on Wednesday, September 17th at 4:15 PM."}...
Message string: {"type":"ConversationText","role":"assistant","content":"I will book you for a haircut on Wednesday, September 17th at 4:15 PM."}
[2025-09-14T11:02:30.520Z] 📨 JSON MESSAGE FROM DEEPGRAM: {"type":"ConversationText","role":"assistant","content":"I will book you for a haircut on Wednesday, September 17th at 4:15 PM."}
[2025-09-14T11:02:30.520Z] === PARSED DEEPGRAM JSON ===
{
  "type": "ConversationText",
  "role": "assistant",
  "content": "I will book you for a haircut on Wednesday, September 17th at 4:15 PM."
}
[2025-09-14T11:02:30.520Z] === END PARSED JSON ===
[2025-09-14T11:02:30.520Z] 🎯 DEEPGRAM EVENT TYPE: ConversationText
[2025-09-14T11:02:30.520Z] 💭 CONVERSATION_TEXT: I will book you for a haircut on Wednesday, September 17th at 4:15 PM.
[2025-09-14T11:02:30.520Z] 🔍 ConversationText role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Added AI: I will book you for a haircut on Wednesday, September 17th at 4:15 PM.
📨 Received Deepgram JSON message: {"type":"History","role":"assistant","content":"I will book you for a haircut on Wednesday, September 17th at 4:15 PM."}...
Message string: {"type":"History","role":"assistant","content":"I will book you for a haircut on Wednesday, September 17th at 4:15 PM."}
[2025-09-14T11:02:30.520Z] 📨 JSON MESSAGE FROM DEEPGRAM: {"type":"History","role":"assistant","content":"I will book you for a haircut on Wednesday, September 17th at 4:15 PM."}
[2025-09-14T11:02:30.520Z] === PARSED DEEPGRAM JSON ===
{
  "type": "History",
  "role": "assistant",
  "content": "I will book you for a haircut on Wednesday, September 17th at 4:15 PM."
}
[2025-09-14T11:02:30.520Z] === END PARSED JSON ===
[2025-09-14T11:02:30.520Z] 🎯 DEEPGRAM EVENT TYPE: History
[2025-09-14T11:02:30.520Z] 📜 HISTORY: Message logged
[2025-09-14T11:02:30.520Z] 🔍 History role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Skipping duplicate AI: I will book you for a haircut on Wednesday, September 17th at 4:15 PM.
[2025-09-14T11:02:30.520Z] 📝 Added transcript: [AI] I will book you for a haircut on Wednesday, September 17th at 4:15 PM.
[2025-09-14T11:02:30.520Z] 🎵 Starting audio stream - feeding buffer
📨 Received Deepgram JSON message: {"type":"FunctionCallRequest","functions":[{"id":"call_gmzZJAtVKwSU3VTmrFLhIpNu","name":"create_booking","arguments":"{\"customer_name\":\"Marco\",\"date\":\"2025-09-17\",\"service_id\":\"haircut\",\"...
Message string: {"type":"FunctionCallRequest","functions":[{"id":"call_gmzZJAtVKwSU3VTmrFLhIpNu","name":"create_booking","arguments":"{\"customer_name\":\"Marco\",\"date\":\"2025-09-17\",\"service_id\":\"haircut\",\"time\":\"16:15\"}","client_side":true}]}
[2025-09-14T11:02:30.577Z] 📨 JSON MESSAGE FROM DEEPGRAM: {"type":"FunctionCallRequest","functions":[{"id":"call_gmzZJAtVKwSU3VTmrFLhIpNu","name":"create_booking","arguments":"{\"customer_name\":\"Marco\",\"date\":\"2025-09-17\",\"service_id\":\"haircut\",\"time\":\"16:15\"}","client_side":true}]}
[2025-09-14T11:02:30.577Z] === PARSED DEEPGRAM JSON ===
{
  "type": "FunctionCallRequest",
  "functions": [
    {
      "id": "call_gmzZJAtVKwSU3VTmrFLhIpNu",
      "name": "create_booking",
      "arguments": "{\"customer_name\":\"Marco\",\"date\":\"2025-09-17\",\"service_id\":\"haircut\",\"time\":\"16:15\"}",
      "client_side": true
    }
  ]
}
[2025-09-14T11:02:30.577Z] === END PARSED JSON ===
[2025-09-14T11:02:30.577Z] 🎯 DEEPGRAM EVENT TYPE: FunctionCallRequest
[2025-09-14T11:02:30.577Z] 🚨🚨 FUNCTION_CALL_REQUEST DETECTED! 🚨🚨
[2025-09-14T11:02:30.577Z] ✅ SUCCESS: AI requesting function calls!
[2025-09-14T11:02:30.577Z] 📋 Functions: [
  {
    "id": "call_gmzZJAtVKwSU3VTmrFLhIpNu",
    "name": "create_booking",
    "arguments": "{\"customer_name\":\"Marco\",\"date\":\"2025-09-17\",\"service_id\":\"haircut\",\"time\":\"16:15\"}",
    "client_side": true
  }
]
[2025-09-14T11:02:30.577Z] ⏸️ SILENCE: Pausing timer - Processing function calls
[2025-09-14T11:02:30.577Z] ⏸️ KEEPALIVE: Paused for function processing
[2025-09-14T11:02:30.577Z] 🔧 Processing function: create_booking
[2025-09-14T11:02:30.577Z] 🔧 CALLING: handleFunctionCall for create_booking...
📝 Session updated for call CAdd20e057568212bf723728af0abb93f2: {
  callerPhone: '+447468306825',
  customerName: 'Marco',
  lastBookingDate: '2025-09-17',
  lastBookingTime: '16:15',
  lastServiceId: 'haircut',
  lastServiceName: 'haircut',
  lastServiceDuration: 30,
  lastAppointmentId: '549d88af-78a4-46be-9c62-e6802ed98d58'
}
[2025-09-14T11:02:30.578Z] 🚀 STARTING handleFunctionCall
[2025-09-14T11:02:30.578Z] 🔧 Function call received: {
  "function_name": "create_booking",
  "function_call_id": "call_gmzZJAtVKwSU3VTmrFLhIpNu",
  "parameters": {
    "customer_name": "Marco",
    "date": "2025-09-17",
    "service_id": "haircut",
    "time": "16:15"
  }
}
[2025-09-14T11:02:30.578Z] 📋 Function name: create_booking
[2025-09-14T11:02:30.578Z] 📊 Parameters: {
  "customer_name": "Marco",
  "date": "2025-09-17",
  "service_id": "haircut",
  "time": "16:15"
}
[2025-09-14T11:02:30.578Z] 🏢 Business config exists: true
[2025-09-14T11:02:30.578Z] 🌐 WebSocket state: 1
🔧 Function call received: {
  "function_name": "create_booking",
  "function_call_id": "call_gmzZJAtVKwSU3VTmrFLhIpNu",
  "parameters": {
    "customer_name": "Marco",
    "date": "2025-09-17",
    "service_id": "haircut",
    "time": "16:15"
  }
}
✅ TRACKING: Added function call ID call_gmzZJAtVKwSU3VTmrFLhIpNu to processed set
🎯 createBooking called with params: {
  "customer_name": "Marco",
  "date": "2025-09-17",
  "service_id": "haircut",
  "time": "16:15"
}
📋 Available services: [
  { id: '4395775e-fa81-4a69-8425-e46c3853dea4', name: 'haircut' },
  { id: '63555ab0-f0ac-48c3-a2b2-766356aeb8f4', name: 'beard trim' }
]
📋 Booking - Found service by name 'haircut' -> ID: 4395775e-fa81-4a69-8425-e46c3853dea4
✅ Booking - Service found: haircut (ID: 4395775e-fa81-4a69-8425-e46c3853dea4 )
📝 Session updated for call CAdd20e057568212bf723728af0abb93f2: {
  callerPhone: '+447468306825',
  customerName: 'Marco',
  lastBookingDate: '2025-09-17',
  lastBookingTime: '16:15',
  lastServiceId: 'haircut',
  lastServiceName: 'haircut',
  lastServiceDuration: 30,
  lastAppointmentId: '549d88af-78a4-46be-9c62-e6802ed98d58'
}
🕐 Creating appointment for 2025-09-17 at 16:15 in timezone: Europe/London
📅 Parsed date: 2025-09-17 (Wednesday)
🕐 Appointment datetime (UK local): 16:15:00
🕐 Business timezone: Europe/London
🕐 Start time: 16:15:00
🕐 End time: 16:45:00
📅 Day of week: Wednesday
🔍 Checking slot availability before booking...
📋 Availability check result: {
  "available": false,
  "businessId": "1bb3c552-053f-40c4-b3f2-bdb51af87b52",
  "serviceId": "4395775e-fa81-4a69-8425-e46c3853dea4",
  "appointmentDate": "2025-09-17",
  "startTime": "16:15:00",
  "endTime": "16:45:00",
  "message": "Slot is not available - conflicts with existing appointment"
}
❌ Slot not available - preventing double booking
✅ Sending create_booking response to Deepgram
✅ Function response sent successfully to Deepgram
🔄 Waiting for Deepgram to process the response...
📨 Received Deepgram JSON message: {"type":"History","function_calls":[{"id":"call_gmzZJAtVKwSU3VTmrFLhIpNu","name":"create_booking","client_side":true,"arguments":"{\"customer_name\":\"Marco\",\"date\":\"2025-09-17\",\"service_id\":\"...
Message string: {"type":"History","function_calls":[{"id":"call_gmzZJAtVKwSU3VTmrFLhIpNu","name":"create_booking","client_side":true,"arguments":"{\"customer_name\":\"Marco\",\"date\":\"2025-09-17\",\"service_id\":\"haircut\",\"time\":\"16:15\"}","response":"{\"error\":\"Sorry, the 16:15 slot on 2025-09-17 is no longer available. Please choose a different time.\"}"}]}
[2025-09-14T11:02:31.866Z] 📨 JSON MESSAGE FROM DEEPGRAM: {"type":"History","function_calls":[{"id":"call_gmzZJAtVKwSU3VTmrFLhIpNu","name":"create_booking","client_side":true,"arguments":"{\"customer_name\":\"Marco\",\"date\":\"2025-09-17\",\"service_id\":\"haircut\",\"time\":\"16:15\"}","response":"{\"error\":\"Sorry, the 16:15 slot on 2025-09-17 is no longer available. Please choose a different time.\"}"}]}
[2025-09-14T11:02:31.866Z] === PARSED DEEPGRAM JSON ===
{
  "type": "History",
  "function_calls": [
    {
      "id": "call_gmzZJAtVKwSU3VTmrFLhIpNu",
      "name": "create_booking",
      "client_side": true,
      "arguments": "{\"customer_name\":\"Marco\",\"date\":\"2025-09-17\",\"service_id\":\"haircut\",\"time\":\"16:15\"}",
      "response": "{\"error\":\"Sorry, the 16:15 slot on 2025-09-17 is no longer available. Please choose a different time.\"}"
    }
  ]
}
[2025-09-14T11:02:31.866Z] === END PARSED JSON ===
[2025-09-14T11:02:31.866Z] 🎯 DEEPGRAM EVENT TYPE: History
[2025-09-14T11:02:31.866Z] 📜 HISTORY: Message logged
[2025-09-14T11:02:30.577Z] ✅ COMPLETED: handleFunctionCall for create_booking
[2025-09-14T11:02:32.722Z] ▶️ KEEPALIVE: Resumed after function processing
[2025-09-14T11:02:30.577Z] ▶️ SILENCE: Resuming timer - Function processing completed
[2025-09-14T11:02:32.761Z] 🔇 Audio stream ended (timeout)
[2025-09-14T11:02:35.082Z] 💓 KEEPALIVE: Sent to Deepgram
📨 Received Deepgram JSON message: {"type":"ConversationText","role":"assistant","content":"Just a moment."}...
Message string: {"type":"ConversationText","role":"assistant","content":"Just a moment."}
[2025-09-14T11:02:36.761Z] 📨 JSON MESSAGE FROM DEEPGRAM: {"type":"ConversationText","role":"assistant","content":"Just a moment."}
[2025-09-14T11:02:36.761Z] === PARSED DEEPGRAM JSON ===
{
  "type": "ConversationText",
  "role": "assistant",
  "content": "Just a moment."
}
[2025-09-14T11:02:36.761Z] === END PARSED JSON ===
[2025-09-14T11:02:36.761Z] 🎯 DEEPGRAM EVENT TYPE: ConversationText
[2025-09-14T11:02:36.761Z] 💭 CONVERSATION_TEXT: Just a moment.
[2025-09-14T11:02:36.761Z] 🔍 ConversationText role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Added AI: Just a moment.
📨 Received Deepgram JSON message: {"type":"History","role":"assistant","content":"Just a moment."}...
Message string: {"type":"History","role":"assistant","content":"Just a moment."}
[2025-09-14T11:02:36.761Z] 📨 JSON MESSAGE FROM DEEPGRAM: {"type":"History","role":"assistant","content":"Just a moment."}
[2025-09-14T11:02:36.761Z] === PARSED DEEPGRAM JSON ===
{
  "type": "History",
  "role": "assistant",
  "content": "Just a moment."
}
[2025-09-14T11:02:36.761Z] === END PARSED JSON ===
[2025-09-14T11:02:36.761Z] 🎯 DEEPGRAM EVENT TYPE: History
[2025-09-14T11:02:36.761Z] 📜 HISTORY: Message logged
[2025-09-14T11:02:36.761Z] 🔍 History role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Skipping duplicate AI: Just a moment.
[2025-09-14T11:02:36.761Z] 📝 Added transcript: [AI] Just a moment.
[2025-09-14T11:02:36.761Z] 🎵 Starting audio stream - feeding buffer
[2025-09-14T11:02:36.765Z] 🔇 Audio stream ended (timeout)
📨 Received Deepgram JSON message: {"type":"ConversationText","role":"assistant","content":"It seems that 4:15 PM on Wednesday, September 17th just got taken."}...
Message string: {"type":"ConversationText","role":"assistant","content":"It seems that 4:15 PM on Wednesday, September 17th just got taken."}
[2025-09-14T11:02:37.882Z] 📨 JSON MESSAGE FROM DEEPGRAM: {"type":"ConversationText","role":"assistant","content":"It seems that 4:15 PM on Wednesday, September 17th just got taken."}
[2025-09-14T11:02:37.882Z] === PARSED DEEPGRAM JSON ===
{
  "type": "ConversationText",
  "role": "assistant",
  "content": "It seems that 4:15 PM on Wednesday, September 17th just got taken."
}
[2025-09-14T11:02:37.882Z] === END PARSED JSON ===
[2025-09-14T11:02:37.882Z] 🎯 DEEPGRAM EVENT TYPE: ConversationText
[2025-09-14T11:02:37.882Z] 💭 CONVERSATION_TEXT: It seems that 4:15 PM on Wednesday, September 17th just got taken.
[2025-09-14T11:02:37.882Z] 🔍 ConversationText role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Added AI: It seems that 4:15 PM on Wednesday, September 17th just got taken.
📨 Received Deepgram JSON message: {"type":"History","role":"assistant","content":"It seems that 4:15 PM on Wednesday, September 17th just got taken."}...
Message string: {"type":"History","role":"assistant","content":"It seems that 4:15 PM on Wednesday, September 17th just got taken."}
[2025-09-14T11:02:37.882Z] 📨 JSON MESSAGE FROM DEEPGRAM: {"type":"History","role":"assistant","content":"It seems that 4:15 PM on Wednesday, September 17th just got taken."}
[2025-09-14T11:02:37.882Z] === PARSED DEEPGRAM JSON ===
{
  "type": "History",
  "role": "assistant",
  "content": "It seems that 4:15 PM on Wednesday, September 17th just got taken."
}
[2025-09-14T11:02:37.882Z] === END PARSED JSON ===
[2025-09-14T11:02:37.882Z] 🎯 DEEPGRAM EVENT TYPE: History
[2025-09-14T11:02:37.882Z] 📜 HISTORY: Message logged
[2025-09-14T11:02:37.882Z] 🔍 History role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Skipping duplicate AI: It seems that 4:15 PM on Wednesday, September 17th just got taken.
[2025-09-14T11:02:37.882Z] 📝 Added transcript: [AI] It seems that 4:15 PM on Wednesday, September 17th just got taken.
[2025-09-14T11:02:37.882Z] 🎵 Starting audio stream - feeding buffer
[2025-09-14T11:02:39.082Z] 💓 KEEPALIVE: Sent to Deepgram
[2025-09-14T11:02:39.704Z] 🔇 Audio stream ended (timeout)
[2025-09-14T11:02:43.082Z] 💓 KEEPALIVE: Sent to Deepgram
📨 Received Deepgram JSON message: {"type":"ConversationText","role":"assistant","content":"From the other options, would you like to try 2:30 PM, 3:30 PM, 3:45 PM, 4:00 PM, or 4:30 PM instead?"}...
Message string: {"type":"ConversationText","role":"assistant","content":"From the other options, would you like to try 2:30 PM, 3:30 PM, 3:45 PM, 4:00 PM, or 4:30 PM instead?"}
[2025-09-14T11:02:44.444Z] 📨 JSON MESSAGE FROM DEEPGRAM: {"type":"ConversationText","role":"assistant","content":"From the other options, would you like to try 2:30 PM, 3:30 PM, 3:45 PM, 4:00 PM, or 4:30 PM instead?"}
[2025-09-14T11:02:44.444Z] === PARSED DEEPGRAM JSON ===
{
  "type": "ConversationText",
  "role": "assistant",
  "content": "From the other options, would you like to try 2:30 PM, 3:30 PM, 3:45 PM, 4:00 PM, or 4:30 PM instead?"
}
[2025-09-14T11:02:44.444Z] === END PARSED JSON ===
[2025-09-14T11:02:44.444Z] 🎯 DEEPGRAM EVENT TYPE: ConversationText
[2025-09-14T11:02:44.444Z] 💭 CONVERSATION_TEXT: From the other options, would you like to try 2:30 PM, 3:30 PM, 3:45 PM, 4:00 PM, or 4:30 PM instead?
[2025-09-14T11:02:44.444Z] 🔍 ConversationText role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Added AI: From the other options, would you like to try 2:30 PM, 3:30 PM, 3:45 PM, 4:00 PM, or 4:30 PM instead?
📨 Received Deepgram JSON message: {"type":"History","role":"assistant","content":"From the other options, would you like to try 2:30 PM, 3:30 PM, 3:45 PM, 4:00 PM, or 4:30 PM instead?"}...
Message string: {"type":"History","role":"assistant","content":"From the other options, would you like to try 2:30 PM, 3:30 PM, 3:45 PM, 4:00 PM, or 4:30 PM instead?"}
[2025-09-14T11:02:44.444Z] 📨 JSON MESSAGE FROM DEEPGRAM: {"type":"History","role":"assistant","content":"From the other options, would you like to try 2:30 PM, 3:30 PM, 3:45 PM, 4:00 PM, or 4:30 PM instead?"}
[2025-09-14T11:02:44.444Z] === PARSED DEEPGRAM JSON ===
{
  "type": "History",
  "role": "assistant",
  "content": "From the other options, would you like to try 2:30 PM, 3:30 PM, 3:45 PM, 4:00 PM, or 4:30 PM instead?"
}
[2025-09-14T11:02:44.444Z] === END PARSED JSON ===
[2025-09-14T11:02:44.444Z] 🎯 DEEPGRAM EVENT TYPE: History
[2025-09-14T11:02:44.444Z] 📜 HISTORY: Message logged
[2025-09-14T11:02:44.444Z] 🔍 History role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Skipping duplicate AI: From the other options, would you like to try 2:30 PM, 3:30 PM, 3:45 PM, 4:00 PM, or 4:30 PM instead?
[2025-09-14T11:02:44.444Z] 📝 Added transcript: [AI] From the other options, would you like to try 2:30 PM, 3:30 PM, 3:45 PM, 4:00 PM, or 4:30 PM instead?
[2025-09-14T11:02:44.444Z] 🎵 Starting audio stream - feeding buffer
📨 Received Deepgram JSON message: {"type":"AgentAudioDone"}...
Message string: {"type":"AgentAudioDone"}
[2025-09-14T11:02:44.487Z] 📨 JSON MESSAGE FROM DEEPGRAM: {"type":"AgentAudioDone"}
[2025-09-14T11:02:44.487Z] === PARSED DEEPGRAM JSON ===
{
  "type": "AgentAudioDone"
}
[2025-09-14T11:02:44.487Z] === END PARSED JSON ===
[2025-09-14T11:02:44.487Z] 🎯 DEEPGRAM EVENT TYPE: AgentAudioDone
[2025-09-14T11:02:44.487Z] 🔇 AGENT_AUDIO_DONE: AI finished sending audio
[2025-09-14T11:02:44.487Z] 🔇 SILENCE: Started tracking
[2025-09-14T11:02:44.487Z] ✅ Agent speech ended. Pacer will now send silence until next utterance.
[2025-09-14T11:02:44.487Z] 🔇 SILENCE_CHECK: 1000ms of silence
[2025-09-14T11:02:44.487Z] 🔇 SILENCE_CHECK: 2000ms of silence
[2025-09-14T11:02:47.083Z] 💓 KEEPALIVE: Sent to Deepgram
[2025-09-14T11:02:44.487Z] 🔇 SILENCE_CHECK: 3000ms of silence
[2025-09-14T11:02:44.487Z] 🔇 SILENCE_CHECK: 4000ms of silence
Media stream stopped
📞 Logging call completion: CAdd20e057568212bf723728af0abb93f2
✅ Call completion logged: CAdd20e057568212bf723728af0abb93f2
✅ Saved transcript for call CAdd20e057568212bf723728af0abb93f2 (36 entries)
🔌 Closing Deepgram connection and cleaning up resources
🔇 Persistent pacer cleaned up
🔇 Silence tracking cleaned up
🧹 CLEANUP: Cleaning up connection state for call CAdd20e057568212bf723728af0abb93f2
✅ Deepgram connection closed successfully
Deepgram WebSocket closed in initializeDeepgram. Code: 1000, Reason: Call ended
Deepgram WebSocket closed. Code: 1000, Reason: Call ended
Twilio WebSocket connection closed
📞 Logging call completion on close: CAdd20e057568212bf723728af0abb93f2
📊 Call duration calculated: 119 seconds
✅ Call completion logged on close: CAdd20e057568212bf723728af0abb93f2
🔌 Closing Deepgram connection and cleaning up resources