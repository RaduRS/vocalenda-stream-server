}
📅 Stored checked date in session: 2025-09-19
✅ Sending get_available_slots response to Deepgram
✅ Function response sent successfully to Deepgram
🔄 Waiting for Deepgram to process the response...
📨 Message string: {"type":"History","function_calls":[{"id":"call_SdaRFWAN6kfjvljzDRWx3nDS","name":"get_available_slots","client_side":true,"arguments":"{\"date\":\"2025-09-19\",\"service_id\":\"haircut\"}","response":"{\"available_slots\":[\"09:00\",\"10:45\",\"11:00\",\"13:45\",\"14:00\",\"16:15\",\"16:30\",\"16:45\",\"17:00\",\"17:15\",\"17:30\"]}"}]}
[18:44:17] 🎯 DEEPGRAM: History
[18:44:17] 📜 HISTORY: Message logged
📨 Message string: {"type":"ConversationText","role":"assistant","content":"For your haircut at 2 PM tomorrow, it is available."}
[18:44:18] 🎯 DEEPGRAM: ConversationText
[18:44:18] 💭 CONVERSATION_TEXT: For your haircut at 2 PM tomorrow, it is available.
📨 Message string: {"type":"History","role":"assistant","content":"For your haircut at 2 PM tomorrow, it is available."}
[18:44:18] 🎯 DEEPGRAM: History
[18:44:18] 📜 HISTORY: Message logged
[18:44:18] 🔍 History role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Added AI: For your haircut at 2 PM tomorrow, it is available.
[18:44:18] 🎵 Starting audio stream - feeding buffer
[18:44:15] ✅ COMPLETED: handleFunctionCall for get_available_slots with ID call_SdaRFWAN6kfjvljzDRWx3nDS (took 2649ms)
[18:44:18] ▶️ KEEPALIVE: Resumed after function processing
[18:44:15] ▶️ SILENCE: Resuming timer - Function processing completed
[18:44:19] 💓 KEEPALIVE: Sent to Deepgram
[18:44:20] 🔇 Audio stream ended (timeout)
[18:44:23] 💓 KEEPALIVE: Sent to Deepgram
📨 Message string: {"type":"ConversationText","role":"assistant","content":"Shall I update your existing haircut appointment to 2 PM?"}
[18:44:23] 🎯 DEEPGRAM: ConversationText
[18:44:23] 💭 CONVERSATION_TEXT: Shall I update your existing haircut appointment to 2 PM?
📨 Message string: {"type":"History","role":"assistant","content":"Shall I update your existing haircut appointment to 2 PM?"}
[18:44:23] 🎯 DEEPGRAM: History
[18:44:23] 📜 HISTORY: Message logged
[18:44:23] 🔍 History role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Added AI: Shall I update your existing haircut appointment to 2 PM?
[18:44:23] 🎵 Starting audio stream - feeding buffer
📨 Message string: {"type":"AgentAudioDone"}
[18:44:23] 🎯 DEEPGRAM: AgentAudioDone
[18:44:23] 🔇 AGENT_AUDIO_DONE: AI finished sending audio
[18:44:23] 🔇 SILENCE: Started tracking
[18:44:23] ✅ Agent speech ended. Pacer will now send silence until next utterance.
[18:44:23] 🔇 SILENCE_CHECK: 1000ms of silence
[18:44:23] 🔇 SILENCE_CHECK: 2000ms of silence
[18:44:23] 🔇 SILENCE_CHECK: 3001ms of silence
[18:44:27] 💓 KEEPALIVE: Sent to Deepgram
[18:44:23] 🔇 SILENCE_CHECK: 4002ms of silence
📨 Message string: {"type":"UserStartedSpeaking"}
[18:44:28] 🎯 DEEPGRAM: UserStartedSpeaking
[18:44:28] 🎤 USER_STARTED_SPEAKING: User began speaking
[18:44:28] 🔄 BARGE_IN: Cleared Twilio audio queue for user speech
[18:44:28] 🔄 BARGE_IN: Cleared local audio buffer and stopped streaming
[18:44:28] 🔄 SILENCE_RESET: User speaking, silence tracking reset
📨 Message string: {"type":"ConversationText","role":"user","content":"Yeah."}
[18:44:29] 🎯 DEEPGRAM: ConversationText
[18:44:29] 💭 CONVERSATION_TEXT: Yeah.
📨 Message string: {"type":"History","role":"user","content":"Yeah."}
[18:44:29] 🎯 DEEPGRAM: History
[18:44:29] 📜 HISTORY: Message logged
[18:44:29] 🔍 History role: 'user' -> Speaker: 'User'
📝 TRANSCRIPT: Added User: Yeah.
[18:44:31] 💓 KEEPALIVE: Sent to Deepgram
📨 Message string: {"type":"FunctionCallRequest","functions":[{"id":"call_Jem8eOGCKPBJVhnL3Bi213Ux","name":"update_booking","arguments":"{\"booking_reference\":\"BK401772E6\",\"new_time\":\"14:00\"}","client_side":true}]}
[18:44:31] 🎯 DEEPGRAM: FunctionCallRequest
[18:44:31] 🚨🚨 FUNCTION_CALL_REQUEST DETECTED! 🚨🚨
[18:44:31] ✅ SUCCESS: AI requesting function calls!
[18:44:31] 🕐 TIMING: Function call request received at 18:44:31
[18:44:31] 📊 FUNCTION COUNT: 1 functions in request
[18:44:31] 📋 Functions: [
  {
    "id": "call_Jem8eOGCKPBJVhnL3Bi213Ux",
    "name": "update_booking",
    "arguments": "{\"booking_reference\":\"BK401772E6\",\"new_time\":\"14:00\"}",
    "client_side": true
  }
]
[18:44:31] 🔍 FUNCTION 1:
[18:44:31]   - Name: update_booking
[18:44:31]   - ID: call_Jem8eOGCKPBJVhnL3Bi213Ux
[18:44:31]   - Arguments: {"booking_reference":"BK401772E6","new_time":"14:00"}
[18:44:31] ⏸️ SILENCE: Pausing timer - Processing function calls
[18:44:31] ⏸️ KEEPALIVE: Paused for function processing
[18:44:31] 🔧 Processing function: update_booking
[18:44:31] 🆔 Function ID: call_Jem8eOGCKPBJVhnL3Bi213Ux
[18:44:31] 📝 Function arguments: {"booking_reference":"BK401772E6","new_time":"14:00"}
[18:44:31] 📦 Created function call data: {
  "function_name": "update_booking",
  "function_call_id": "call_Jem8eOGCKPBJVhnL3Bi213Ux",
  "parameters": {
    "booking_reference": "BK401772E6",
    "new_time": "14:00"
  }
}
[18:44:31] 🔧 CALLING: handleFunctionCall for update_booking with ID call_Jem8eOGCKPBJVhnL3Bi213Ux...
📝 Session updated for call CAbba0c405ec3cb4ba73e3a7cf43c5098b: {
  callerPhone: '+447468306825',
  lastCheckedDate: '2025-09-19',
  lastCheckedTimestamp: '18:44:17',
  customerName: 'Marco',
  lastBookingDate: '2025-09-19',
  lastBookingTime: '13:30',
  lastServiceId: '754eb430-291c-42b7-8f26-2d8a99828ee5',
  lastServiceName: 'beard trim',
  lastServiceDuration: 15,
  bookings: [
    {
      bookingReference: 'BK401772E6',
      customerName: 'Marco',
      date: '2025-09-19',
      time: '13:00',
      serviceId: 'haircut',
      serviceName: 'haircut',
      serviceDuration: 30,
      appointmentId: 'be5428a3-c92d-4620-bf8e-cd81591e51fb',
      type: 'create'
    },
    {
      bookingReference: 'BK4366736A',
      customerName: 'Marco',
      date: '2025-09-19',
      time: '13:30',
      serviceId: '754eb430-291c-42b7-8f26-2d8a99828ee5',
      serviceName: 'beard trim',
      serviceDuration: 15,
      appointmentId: 'd8055c25-c85b-4e7b-b607-8e4776357ed5',
      type: 'create'
    }
  ],
  lastAppointmentId: 'd8055c25-c85b-4e7b-b607-8e4776357ed5'
}
[18:44:31] 🚀 FUNCTION: update_booking
[18:44:31] 📝 UPDATE_BOOKING: Booking reference BK401772E6
📋 Session data: {
  callerPhone: '+447468306825',
  lastCheckedDate: '2025-09-19',
  lastCheckedTimestamp: '18:44:17',
  customerName: 'Marco',
  lastBookingDate: '2025-09-19',
  lastBookingTime: '13:30',
  lastServiceId: '754eb430-291c-42b7-8f26-2d8a99828ee5',
  lastServiceName: 'beard trim',
  lastServiceDuration: 15,
  bookings: [
    {
      bookingReference: 'BK401772E6',
      customerName: 'Marco',
      date: '2025-09-19',
      time: '13:00',
      serviceId: 'haircut',
      serviceName: 'haircut',
      serviceDuration: 30,
      appointmentId: 'be5428a3-c92d-4620-bf8e-cd81591e51fb',
      type: 'create'
    },
    {
      bookingReference: 'BK4366736A',
      customerName: 'Marco',
      date: '2025-09-19',
      time: '13:30',
      serviceId: '754eb430-291c-42b7-8f26-2d8a99828ee5',
      serviceName: 'beard trim',
      serviceDuration: 15,
      appointmentId: 'd8055c25-c85b-4e7b-b607-8e4776357ed5',
      type: 'create'
    }
  ],
  lastAppointmentId: 'd8055c25-c85b-4e7b-b607-8e4776357ed5'
}
🎯 Found target booking by reference: {
  reference: 'BK401772E6',
  appointmentId: 'be5428a3-c92d-4620-bf8e-cd81591e51fb',
  service: 'haircut',
  date: '2025-09-19',
  time: '13:00'
}
🔄 Using customer info: {
  customerName: 'Marco',
  currentDate: '2025-09-19',
  currentTime: '13:00'
}
📞 Caller phone: +447468306825
👤 Customer: Marco
📅 Booking: 2025-09-19 at 13:00
📅 Using date/time for session booking: 2025-09-19 at 13:00
📝 Session updated for call CAbba0c405ec3cb4ba73e3a7cf43c5098b: {
  callerPhone: '+447468306825',
  lastCheckedDate: '2025-09-19',
  lastCheckedTimestamp: '18:44:17',
  customerName: 'Marco',
  lastBookingDate: '2025-09-19',
  lastBookingTime: '14:00',
  lastServiceId: '754eb430-291c-42b7-8f26-2d8a99828ee5',
  lastServiceName: 'beard trim',
  lastServiceDuration: 15,
  bookings: [
    {
      bookingReference: 'BK401772E6',
      customerName: 'Marco',
      date: '2025-09-19',
      time: '13:00',
      serviceId: 'haircut',
      serviceName: 'haircut',
      serviceDuration: 30,
      appointmentId: 'be5428a3-c92d-4620-bf8e-cd81591e51fb',
      type: 'create'
    },
    {
      bookingReference: 'BK4366736A',
      customerName: 'Marco',
      date: '2025-09-19',
      time: '13:30',
      serviceId: '754eb430-291c-42b7-8f26-2d8a99828ee5',
      serviceName: 'beard trim',
      serviceDuration: 15,
      appointmentId: 'd8055c25-c85b-4e7b-b607-8e4776357ed5',
      type: 'create'
    },
    {
      customerName: 'Marco',
      currentDate: '2025-09-19',
      currentTime: '13:00',
      newDate: undefined,
      newTime: '14:00',
      newServiceId: undefined,
      type: 'update'
    }
  ],
  lastAppointmentId: 'd8055c25-c85b-4e7b-b607-8e4776357ed5'
}
📦 Update request body: {
  "business_id": "1bb3c552-053f-40c4-b3f2-bdb51af87b52",
  "customer_name": "Marco",
  "caller_phone": "+447468306825",
  "sessionId": "CAbba0c405ec3cb4ba73e3a7cf43c5098b",
  "current_date": "2025-09-19",
  "current_time": "13:00",
  "new_time": "14:00"
}
✅ Sending update_booking response to Deepgram
❌ Update booking API error: 409 {"error":"The time slot 2025-09-19 at 14:00 is not available. Please select another time.","fillerPhrase":"Of course Marco, changing your to 14:00...","sessionId":"CAbba0c405ec3cb4ba73e3a7cf43c5098b"}
✅ Function response sent successfully to Deepgram
🔄 Waiting for Deepgram to process the response...
📨 Message string: {"type":"History","function_calls":[{"id":"call_Jem8eOGCKPBJVhnL3Bi213Ux","name":"update_booking","client_side":true,"arguments":"{\"booking_reference\":\"BK401772E6\",\"new_time\":\"14:00\"}","response":"{\"error\":\"Failed to update booking: {\\\"error\\\":\\\"The time slot 2025-09-19 at 14:00 is not available. Please select another time.\\\",\\\"fillerPhrase\\\":\\\"Of course Marco, changing your to 14:00...\\\",\\\"sessionId\\\":\\\"CAbba0c405ec3cb4ba73e3a7cf43c5098b\\\"}\"}"}]}
[18:44:34] 🎯 DEEPGRAM: History
[18:44:34] 📜 HISTORY: Message logged
[18:44:31] ✅ COMPLETED: handleFunctionCall for update_booking with ID call_Jem8eOGCKPBJVhnL3Bi213Ux (took 3926ms)
[18:44:35] ▶️ KEEPALIVE: Resumed after function processing
[18:44:31] ▶️ SILENCE: Resuming timer - Function processing completed
📨 Message string: {"type":"ConversationText","role":"assistant","content":"I'm sorry, it seems 2 PM is showing as available but the system couldn't update your haircut to that time."}
[18:44:36] 🎯 DEEPGRAM: ConversationText
[18:44:36] 💭 CONVERSATION_TEXT: I'm sorry, it seems 2 PM is showing as available but the system couldn't update your haircut to that time.
📨 Message string: {"type":"History","role":"assistant","content":"I'm sorry, it seems 2 PM is showing as available but the system couldn't update your haircut to that time."}
[18:44:36] 🎯 DEEPGRAM: History
[18:44:36] 📜 HISTORY: Message logged
[18:44:36] 🔍 History role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Added AI: I'm sorry, it seems 2 PM is showing as available but the system couldn't update your haircut to that time.
[18:44:36] 🎵 Starting audio stream - feeding buffer
[18:44:39] 💓 KEEPALIVE: Sent to Deepgram
[18:44:38] 🔇 Audio stream ended (timeout)
📨 Message string: {"type":"ConversationText","role":"assistant","content":"The closest available times around 2 PM are 1:45 PM or 4:15 PM."}
[18:44:41] 🎯 DEEPGRAM: ConversationText
[18:44:41] 💭 CONVERSATION_TEXT: The closest available times around 2 PM are 1:45 PM or 4:15 PM.
📨 Message string: {"type":"History","role":"assistant","content":"The closest available times around 2 PM are 1:45 PM or 4:15 PM."}
[18:44:41] 🎯 DEEPGRAM: History
[18:44:41] 📜 HISTORY: Message logged
[18:44:41] 🔍 History role: 'assistant' -> Speaker: 'AI'
📝 TRANSCRIPT: Added AI: The closest available times around 2 PM are 1:45 PM or 4:15 PM.
[18:44:41] 🎵 Starting audio stream - feeding buffer
[18:44:42] 🔇 Audio stream ended (timeout)
[18:44:43] 💓 KEEPALIVE: Sent to Deepgram
Media stream stopped
📞 Logging call completion: CAbba0c405ec3cb4ba73e3a7cf43c5098b
✅ Call completion logged: CAbba0c405ec3cb4ba73e3a7cf43c5098b
📱 Media stream stopped - sending SMS confirmations for CAbba0c405ec3cb4ba73e3a7cf43c5098b
📞 endCall called with params: {
  "reason": "media stream stopped"
}
📞 Call SID: CAbba0c405ec3cb4ba73e3a7cf43c5098b
📋 Session data before ending call: {
  callerPhone: '+447468306825',
  lastCheckedDate: '2025-09-19',
  lastCheckedTimestamp: '18:44:17',
  customerName: 'Marco',
  lastBookingDate: '2025-09-19',
  lastBookingTime: '14:00',
  lastServiceId: '754eb430-291c-42b7-8f26-2d8a99828ee5',
  lastServiceName: 'beard trim',



  "caller_phone": "+447468306825",
  "sessionId": "CA18bfbae82955b4f0f4e279cf9e0b7d18",
  "appointment_id": "8ced1e99-1e50-490b-8d28-b1fe95cba4d8",
  "new_time": "17:00"
}
✅ Sending update_booking response to Deepgram
❌ Update booking API error: 400 {"error":"Missing required parameters: business_id, customer_name, current_date, current_time"}
✅ Function response sent successfully to Deepgram
🔄 Waiting for Deepgram to process the response...
📨 Message string: {"type":"History","function_calls":[{"id":"call_TLOqz34vF7xcwx6CIJzgf6je","name":"update_booking","client_side":true,"arguments":"{\"booking_reference\":\"BK647499S4\",\"customer_name\":\"Marco\",\"current_date\":\"2025-09-19\",\"current_time\":\"15:00\",\"new_time\":\"17:00\"}","response":"{\"error\":\"Failed to update booking: {\\\"error\\\":\\\"Missing required parameters: business_id, customer_name, current_date, current_time\\\"}\"}"}]}
[18:48:40] 🎯 DEEPGRAM: History
[18:48:40] 📜 HISTORY: Message logged
[18:48:40] ✅ COMPLETED: handleFunctionCall for update_booking with ID call_TLOqz34vF7xcwx6CIJzgf6je (took 1182ms)
[18:48:41] ▶️ KEEPALIVE: Resumed after function processing
[18:48:40] ▶️ SILENCE: Resuming timer - Function processing completed