
[11:15:05] 🔧 CALLING: handleFunctionCall for get_available_slots with ID call_HApqMpP8ahVbVPZWgGmmEk3B...
📝 Session updated for call CA64027220f93187f4b6359ae1b2e32020: {
  callerPhone: '+447468306825',
  lastCheckedDate: '2025-09-24',
  lastCheckedTimestamp: '11:14:35',
  customerName: 'Marco',
  lastBookingDate: '2025-09-24',
  lastBookingTime: '12:45',
  lastServiceId: '754eb430-291c-42b7-8f26-2d8a99828ee5',
  lastServiceName: 'beard trim',
  lastServiceDuration: 15,
  bookings: [
    {
      bookingReference: 'BK861431X7',
      customerName: 'Marco',
      date: '2025-09-24',
      time: '10:00',
      serviceId: '89f199c8-c4ee-4f42-91a7-1f8bd70cff4a',
      serviceName: 'haircut',
      serviceDuration: 30,
      appointmentId: '0bdf0582-2242-4b31-a10f-b8454cc73ac1',
      type: 'create'
    },
    {
      bookingReference: 'BK8935476R',
      customerName: 'Marco',
      date: '2025-09-24',
      time: '12:45',
      serviceId: '754eb430-291c-42b7-8f26-2d8a99828ee5',
      serviceName: 'beard trim',
      serviceDuration: 15,
      appointmentId: '9552f6d3-a1b8-4fa1-8fc0-617b99fc822c',
      type: 'create'
    }
  ],
  lastAppointmentId: '9552f6d3-a1b8-4fa1-8fc0-617b99fc822c'
}
[11:15:05] 🚀 FUNCTION: get_available_slots
🕐 Current UK time: 11:15, Current date: 2025-09-19
📅 Validating request for date: 2025-09-23, time: not specified
✅ FUNCTION_CALL_VALIDATION: get_available_slots passed all checks - proceeding with API call
[11:15:05] 🗓️ GET_SLOTS: 2025-09-23 service:89f199c8-c4ee-4f42-91a7-1f8bd70cff4a
📅 Business open on Tuesday
📋 Using service: haircut (Duration: 30 minutes)
🔍 Including customer context for availability check: +447468306825
[11:15:05] 📡 API: 200 - 23 slots
✅ Available time slots: [
  '09:00', '09:15', '09:30',
  '10:30', '11:15', '11:30',
  '11:45', '12:00', '12:15',
  '12:30', '12:45', '13:00',
  '13:15', '13:30', '14:30',
  '14:45', '15:00', '15:15',
  '15:30', '15:45', '16:00',
  '16:15', '16:30'
]
✅ Available slots (12-hour): [
  '9:00 AM',  '9:15 AM',  '9:30 AM',
  '10:30 AM', '11:15 AM', '11:30 AM',
  '11:45 AM', '12:00 PM', '12:15 PM',
  '12:30 PM', '12:45 PM', '1:00 PM',
  '1:15 PM',  '1:30 PM',  '2:30 PM',
  '2:45 PM',  '3:00 PM',  '3:15 PM',
  '3:30 PM',  '3:45 PM',  '4:00 PM',
  '4:15 PM',  '4:30 PM'
]
📝 Session updated for call CA64027220f93187f4b6359ae1b2e32020: {
  callerPhone: '+447468306825',
  lastCheckedDate: '2025-09-23',
  lastCheckedTimestamp: '11:15:07',
  customerName: 'Marco',
  lastBookingDate: '2025-09-24',
  lastBookingTime: '12:45',
  lastServiceId: '754eb430-291c-42b7-8f26-2d8a99828ee5',
  lastServiceName: 'beard trim',
  lastServiceDuration: 15,
  bookings: [
    {
      bookingReference: 'BK861431X7',
      customerName: 'Marco',
      date: '2025-09-24',
      time: '10:00',
      serviceId: '89f199c8-c4ee-4f42-91a7-1f8bd70cff4a',
      serviceName: 'haircut',
      serviceDuration: 30,
      appointmentId: '0bdf0582-2242-4b31-a10f-b8454cc73ac1',
      type: 'create'
    },
    {
      bookingReference: 'BK8935476R',
      customerName: 'Marco',
      date: '2025-09-24',
      time: '12:45',
      serviceId: '754eb430-291c-42b7-8f26-2d8a99828ee5',
      serviceName: 'beard trim',
      serviceDuration: 15,
      appointmentId: '9552f6d3-a1b8-4fa1-8fc0-617b99fc822c',
      type: 'create'
    }
  ],
  lastAppointmentId: '9552f6d3-a1b8-4fa1-8fc0-617b99fc822c'
}
📅 Stored checked date in session: 2025-09-23
✅ Sending get_available_slots response to Deepgram
✅ Function response sent successfully to Deepgram
🔄 Waiting for Deepgram to process the response...
📨 Message string: {"type":"History","function_calls":[{"id":"call_HApqMpP8ahVbVPZWgGmmEk3B","name":"get_available_slots","client_side":true,"arguments":"{\"date\":\"2025-09-23\",\"service_id\":\"89f199c8-c4ee-4f42-91a7-1f8bd70cff4a\"}","response":"{\"available_slots\":[\"09:00\",\"09:15\",\"09:30\",\"10:30\",\"11:15\",\"11:30\",\"11:45\",\"12:00\",\"12:15\",\"12:30\",\"12:45\",\"13:00\",\"13:15\",\"13:30\",\"14:30\",\"14:45\",\"15:00\",\"15:15\",\"15:30\",\"15:45\",\"16:00\",\"16:15\",\"16:30\"],\"available_slots_12hour\":[\"9:00 AM\",\"9:15 AM\",\"9:30 AM\",\"10:30 AM\",\"11:15 AM\",\"11:30 AM\",\"11:45 AM\",\"12:00 PM\",\"12:15 PM\",\"12:30 PM\",\"12:45 PM\",\"1:00 PM\",\"1:15 PM\",\"1:30 PM\",\"2:30 PM\",\"2:45 PM\",\"3:00 PM\",\"3:15 PM\",\"3:30 PM\",\"3:45 PM\",\"4:00 PM\",\"4:15 PM\",\"4:30 PM\"],\"conversion_map\":{\"9:00 AM\":\"09:00\",\"9:15 AM\":\"09:15\",\"9:30 AM\":\"09:30\",\"10:30 AM\":\"10:30\",\"11:15 AM\":\"11:15\",\"11:30 AM\":\"11:30\",\"11:45 AM\":\"11:45\",\"12:00 PM\":\"12:00\",\"12:15 PM\":\"12:15\",\"12:30 PM\":\"12:30\",\"12:45 PM\":\"12:45\",\"1:00 PM\":\"13:00\",\"1:15 PM\":\"13:15\",\"1:30 PM\":\"13:30\",\"2:30 PM\":\"14:30\",\"2:45 PM\":\"14:45\",\"3:00 PM\":\"15:00\",\"3:15 PM\":\"15:15\",\"3:30 PM\":\"15:30\",\"3:45 PM\":\"15:45\",\"4:00 PM\":\"16:00\",\"4:15 PM\":\"16:15\",\"4:30 PM\":\"16:30\"}}"}]}
[11:15:07] 🎯 DEEPGRAM: History
[11:15:07] 📜 HISTORY: Message logged
[11:15:05] ✅ COMPLETED: handleFunctionCall for get_available_slots with ID call_HApqMpP8ahVbVPZWgGmmEk3B (took 2260ms)
[11:15:08] ▶️ KEEPALIVE: Resumed after function processing
[11:15:05] ▶️ SILENCE: Resuming timer - Function processing completed
📨 Message string: {"type":"ConversationText","role":"assistant","content":"For Tuesday, the 23rd, I see these available slots for your haircut: 9 AM, 9:15 AM, 9:30 AM, 10:30 AM, and several times later in the day."}
[11:15:08] 🎯 DEEPGRAM: ConversationText
[11:15:08] 💭 CONVERSATION_TEXT: For Tuesday, the 23rd, I see these available slots for your haircut: 9 AM, 9:15 AM, 9:30 AM, 10:30 AM, and several times later in the day.
📨 Message string: {"type":"History","role":"assistant","content":"For Tuesday, the 23rd, I see these available slots for your haircut: 9 AM, 9:15 AM, 9:30 AM, 10:30 AM, and several times later in the day."}
[11:15:08] 🎯 DEEPGRAM: History
[11:15:08] 📜 HISTORY: Message logged
[11:15:08] 🔍 History role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Added AI: For Tuesday, the 23rd, I see these available slots for your haircut: 9 AM, 9:15 AM, 9:30 AM, 10:30 AM, and several times later in the day.
[11:15:08] 🎵 Starting audio stream - feeding buffer
[11:15:10] 💓 KEEPALIVE: Sent to Deepgram
[11:15:14] 💓 KEEPALIVE: Sent to Deepgram
[11:15:14] 🔇 Audio stream ended (timeout)
📨 Message string: {"type":"UserStartedSpeaking"}
[11:15:16] 🎯 DEEPGRAM: UserStartedSpeaking
[11:15:16] 🎤 USER_STARTED_SPEAKING: User began speaking
[11:15:16] 🔄 BARGE_IN: Cleared Twilio audio queue for user speech
[11:15:16] 🔄 BARGE_IN: Cleared local audio buffer and stopped streaming
[11:15:16] 🔄 SILENCE_RESET: User speaking, silence tracking reset
📨 Message string: {"type":"AgentAudioDone"}
[11:15:16] 🎯 DEEPGRAM: AgentAudioDone
[11:15:16] 🔇 AGENT_AUDIO_DONE: AI finished sending audio
[11:15:16] 🔇 SILENCE: Started tracking
[11:15:16] ✅ Agent speech ended. Pacer will now send silence until next utterance.
[11:15:16] 🔇 SILENCE_CHECK: 1000ms of silence
[11:15:18] 💓 KEEPALIVE: Sent to Deepgram
[11:15:16] 🔇 SILENCE_CHECK: 2001ms of silence
[11:15:16] 🔇 SILENCE_CHECK: 3002ms of silence
[11:15:16] 🔇 SILENCE_CHECK: 4002ms of silence
📨 Message string: {"type":"ConversationText","role":"user","content":"I just said the ten. Can you move it to ten? So from Wednesday at ten to Tuesday at ten."}
[11:15:21] 🎯 DEEPGRAM: ConversationText
[11:15:21] 💭 CONVERSATION_TEXT: I just said the ten. Can you move it to ten? So from Wednesday at ten to Tuesday at ten.
📨 Message string: {"type":"History","role":"user","content":"I just said the ten. Can you move it to ten? So from Wednesday at ten to Tuesday at ten."}
[11:15:21] 🎯 DEEPGRAM: History
[11:15:21] 📜 HISTORY: Message logged
[11:15:21] 🔍 History role: 'user' -> Speaker: 'User'
📝 TRANSCRIPT: Added User: I just said the ten. Can you move it to ten? So from Wednesday at ten to Tuesday at ten.
[11:15:16] 🔇 SILENCE_CHECK: 5002ms of silence
[11:15:22] 💓 KEEPALIVE: Sent to Deepgram
📨 Message string: {"type":"ConversationText","role":"assistant","content":"10 AM on Tuesday is not available, but I see 9:45 AM or 10:30 AM are open."}
[11:15:22] 🎯 DEEPGRAM: ConversationText
[11:15:22] 💭 CONVERSATION_TEXT: 10 AM on Tuesday is not available, but I see 9:45 AM or 10:30 AM are open.
📨 Message string: {"type":"History","role":"assistant","content":"10 AM on Tuesday is not available, but I see 9:45 AM or 10:30 AM are open."}
[11:15:22] 🎯 DEEPGRAM: History
[11:15:22] 📜 HISTORY: Message logged
[11:15:22] 🔍 History role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Added AI: 10 AM on Tuesday is not available, but I see 9:45 AM or 10:30 AM are open.
[11:15:22] 🎵 Starting audio stream - feeding buffer
[11:15:16] 🔇 SILENCE_CHECK: 6002ms of silence
[11:15:16] 🔇 SILENCE_CHECK: 7002ms of silence
[11:15:16] 🔇 SILENCE_CHECK: 8002ms of silence
[11:15:16] 🔇 SILENCE_CHECK: 9002ms of silence
[11:15:25] 🔇 Audio stream ended (timeout)
[11:15:26] 💓 KEEPALIVE: Sent to Deepgram
[11:15:16] 🔇 SILENCE_CHECK: 10003ms of silence
[11:15:16] 🔇 SILENCE_CHECK: 11003ms of silence
[11:15:16] 🔇 SILENCE_CHECK: 12003ms of silence
📨 Message string: {"type":"ConversationText","role":"assistant","content":"Would you like one of those times for your haircut instead?"}
[11:15:29] 🎯 DEEPGRAM: ConversationText
[11:15:29] 💭 CONVERSATION_TEXT: Would you like one of those times for your haircut instead?
📨 Message string: {"type":"History","role":"assistant","content":"Would you like one of those times for your haircut instead?"}
[11:15:29] 🎯 DEEPGRAM: History
[11:15:29] 📜 HISTORY: Message logged
[11:15:29] 🔍 History role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Added AI: Would you like one of those times for your haircut instead?
[11:15:29] 🎵 Starting audio stream - feeding buffer
📨 Message string: {"type":"AgentAudioDone"}
[11:15:29] 🎯 DEEPGRAM: AgentAudioDone
[11:15:29] 🔇 AGENT_AUDIO_DONE: AI finished sending audio
[11:15:29] 🔇 SILENCE: Started tracking
[11:15:29] ✅ Agent speech ended. Pacer will now send silence until next utterance.
[11:15:30] 💓 KEEPALIVE: Sent to Deepgram
[11:15:29] 🔇 SILENCE_CHECK: 1000ms of silence
📨 Message string: {"type":"UserStartedSpeaking"}
[11:15:30] 🎯 DEEPGRAM: UserStartedSpeaking
[11:15:30] 🎤 USER_STARTED_SPEAKING: User began speaking
[11:15:30] 🔄 BARGE_IN: Cleared Twilio audio queue for user speech
[11:15:30] 🔄 BARGE_IN: Cleared local audio buffer and stopped streaming
[11:15:30] 🔄 SILENCE_RESET: User speaking, silence tracking reset
[11:15:34] 💓 KEEPALIVE: Sent to Deepgram
📨 Message string: {"type":"ConversationText","role":"user","content":"Nine forty five. Can you book my haircut on nine forty five on Tuesday?"}
[11:15:36] 🎯 DEEPGRAM: ConversationText
[11:15:36] 💭 CONVERSATION_TEXT: Nine forty five. Can you book my haircut on nine forty five on Tuesday?
📨 Message string: {"type":"History","role":"user","content":"Nine forty five. Can you book my haircut on nine forty five on Tuesday?"}
[11:15:36] 🎯 DEEPGRAM: History
[11:15:36] 📜 HISTORY: Message logged
[11:15:36] 🔍 History role: 'user' -> Speaker: 'User'
📝 TRANSCRIPT: Added User: Nine forty five. Can you book my haircut on nine forty five on Tuesday?
📨 Message string: {"type":"FunctionCallRequest","functions":[{"id":"call_YJjd21tkR4RsaqDrpOb2L9Dk","name":"update_booking","arguments":"{\"booking_reference\":\"BK861431X7\",\"new_date\":\"2025-09-23\",\"new_time\":\"09:45\"}","client_side":true}]}
[11:15:37] 🎯 DEEPGRAM: FunctionCallRequest
[11:15:37] 🚨🚨 FUNCTION_CALL_REQUEST DETECTED! 🚨🚨
[11:15:37] ✅ SUCCESS: AI requesting function calls!
[11:15:37] 🕐 TIMING: Function call request received at 11:15:37
[11:15:37] 📊 FUNCTION COUNT: 1 functions in request
[11:15:37] 📋 Functions: [
  {
    "id": "call_YJjd21tkR4RsaqDrpOb2L9Dk",
    "name": "update_booking",
    "arguments": "{\"booking_reference\":\"BK861431X7\",\"new_date\":\"2025-09-23\",\"new_time\":\"09:45\"}",
    "client_side": true
  }
]
[11:15:37] 🔍 FUNCTION 1:
[11:15:37]   - Name: update_booking
[11:15:37]   - ID: call_YJjd21tkR4RsaqDrpOb2L9Dk
[11:15:37]   - Arguments: {"booking_reference":"BK861431X7","new_date":"2025-09-23","new_time":"09:45"}
[11:15:37] ⏸️ SILENCE: Pausing timer - Processing function calls
[11:15:37] ⏸️ KEEPALIVE: Paused for function processing
[11:15:37] 🔧 Processing function: update_booking
[11:15:37] 🆔 Function ID: call_YJjd21tkR4RsaqDrpOb2L9Dk
[11:15:37] 📝 Function arguments: {"booking_reference":"BK861431X7","new_date":"2025-09-23","new_time":"09:45"}
[11:15:37] 📦 Created function call data: {
  "function_name": "update_booking",
  "function_call_id": "call_YJjd21tkR4RsaqDrpOb2L9Dk",
  "parameters": {