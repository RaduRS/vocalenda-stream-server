
[2025-09-12T08:44:28.712Z] === END PARSED JSON ===
[2025-09-12T08:44:28.712Z] 🎯 DEEPGRAM EVENT TYPE: FunctionCallRequest
[2025-09-12T08:44:28.712Z] 🚨🚨 FUNCTION_CALL_REQUEST DETECTED! 🚨🚨
[2025-09-12T08:44:28.712Z] ✅ SUCCESS: AI requesting function calls!
[2025-09-12T08:44:28.712Z] 📋 Functions: [
  {
    "id": "call_8nvhTYhvaytVqKUtz4nyIXaU",
    "name": "cancel_booking",
    "arguments": "{\"customer_name\":\"Marco\",\"date\":\"2025-09-12\",\"time\":\"14:00\"}",
    "client_side": true
  }
]
[2025-09-12T08:44:28.712Z] ⏸️ KEEPALIVE: Paused for function processing
[2025-09-12T08:44:28.712Z] 🔧 Processing function: cancel_booking
[2025-09-12T08:44:28.712Z] 🔧 CALLING: handleFunctionCall for cancel_booking...
📝 Session updated for call CAeb1cbd6b30b9b5f3f6616c0df2ca7b02: { callerPhone: '+447468306825' }
[2025-09-12T08:44:28.712Z] 🚀 STARTING handleFunctionCall
[2025-09-12T08:44:28.712Z] 🔧 Function call received: {
  "function_name": "cancel_booking",
  "function_call_id": "call_8nvhTYhvaytVqKUtz4nyIXaU",
  "parameters": {
    "customer_name": "Marco",
    "date": "2025-09-12",
    "time": "14:00"
  }
}
[2025-09-12T08:44:28.712Z] 📋 Function name: cancel_booking
[2025-09-12T08:44:28.712Z] 📊 Parameters: {
  "customer_name": "Marco",
  "date": "2025-09-12",
  "time": "14:00"
}
[2025-09-12T08:44:28.712Z] 🏢 Business config exists: true
[2025-09-12T08:44:28.712Z] 🌐 WebSocket state: 1
🔧 Function call received: {
  "function_name": "cancel_booking",
  "function_call_id": "call_8nvhTYhvaytVqKUtz4nyIXaU",
  "parameters": {
    "customer_name": "Marco",
    "date": "2025-09-12",
    "time": "14:00"
  }
}
❌ cancelBooking called with params: {
  "customer_name": "Marco",
  "date": "2025-09-12",
  "time": "14:00"
}
📋 Session data for cancellation: { callerPhone: '+447468306825' }
🔄 Using booking info for cancellation: { customerName: 'Marco', date: '2025-09-12', time: '14:00' }
📞 Caller phone: +447468306825
👤 Customer: Marco
📅 Booking: 2025-09-12 at 14:00
[2025-09-12T08:44:16.276Z] 📞 ENDING_CALL: Terminating call after silence timeout
📞 endCall called with params: {
  "reason": "silence timeout - auto disconnect"
}
📞 Call SID: CAeb1cbd6b30b9b5f3f6616c0df2ca7b02
📋 Session data before ending call: { callerPhone: '+447468306825' }
📞 Attempting to end call with SID: CAeb1cbd6b30b9b5f3f6616c0df2ca7b02
📝 Reason: silence timeout - auto disconnect
📨 Received Deepgram JSON message: {"type":"ConversationText","role":"assistant","content":"I will confirm the day silently to proceed."}...
Message string: {"type":"ConversationText","role":"assistant","content":"I will confirm the day silently to proceed."}
[2025-09-12T08:44:30.931Z] 📨 JSON MESSAGE FROM DEEPGRAM: {"type":"ConversationText","role":"assistant","content":"I will confirm the day silently to proceed."}
[2025-09-12T08:44:30.931Z] === PARSED DEEPGRAM JSON ===
{
  "type": "ConversationText",
  "role": "assistant",
  "content": "I will confirm the day silently to proceed."
}
[2025-09-12T08:44:30.931Z] === END PARSED JSON ===
[2025-09-12T08:44:30.931Z] 🎯 DEEPGRAM EVENT TYPE: ConversationText
[2025-09-12T08:44:30.931Z] 💭 CONVERSATION_TEXT: I will confirm the day silently to proceed.
📝 Added transcript: [AI] I will confirm the day silently to proceed.
✅ Call ended successfully: completed
🗑️ Session cleared for call CAeb1cbd6b30b9b5f3f6616c0df2ca7b02
📨 Received Deepgram JSON message: {"type":"History","role":"assistant","content":"I will confirm the day silently to proceed."}...
Message string: {"type":"History","role":"assistant","content":"I will confirm the day silently to proceed."}
[2025-09-12T08:44:31.082Z] 📨 JSON MESSAGE FROM DEEPGRAM: {"type":"History","role":"assistant","content":"I will confirm the day silently to proceed."}
[2025-09-12T08:44:31.082Z] === PARSED DEEPGRAM JSON ===
{
  "type": "History",
  "role": "assistant",
  "content": "I will confirm the day silently to proceed."
}
[2025-09-12T08:44:31.082Z] === END PARSED JSON ===
[2025-09-12T08:44:31.082Z] 🎯 DEEPGRAM EVENT TYPE: History
[2025-09-12T08:44:31.082Z] ❓ UNKNOWN_EVENT_TYPE: History
[2025-09-12T08:44:31.082Z] 📦 Full message: {
  "type": "History",
  "role": "assistant",
  "content": "I will confirm the day silently to proceed."
}
[2025-09-12T08:44:31.083Z] 🎵 Starting audio stream - feeding buffer
Media stream stopped
📞 Logging call completion: CAeb1cbd6b30b9b5f3f6616c0df2ca7b02
✅ Call completion logged: CAeb1cbd6b30b9b5f3f6616c0df2ca7b02
✅ Saved transcript for call CAeb1cbd6b30b9b5f3f6616c0df2ca7b02 (9 entries)
🔌 Closing Deepgram connection and cleaning up resources
🔇 Persistent pacer cleaned up
🔇 Silence tracking cleaned up
✅ Deepgram connection closed successfully
✅ Booking cancelled successfully: {
  success: true,
  message: 'Booking cancelled successfully',
  booking: {
    id: 'd57ee769-709f-4759-a543-a02ecf875f1c',
    customer_name: 'Marco',
    date: '2025-09-12',
    start_time: '14:00:00',
    end_time: '14:30:00',
    status: 'cancelled',
    cancellation_reason: 'Customer requested cancellation'
  }
}
✅ Sending cancel_booking response to Deepgram
❌ Cannot send function response - Deepgram connection not open
   - WebSocket exists: true
   - ReadyState: 2
❌ Error sending response to Deepgram: Error: Deepgram connection not available
    at handleFunctionCall (file:///opt/render/project/src/functionHandlers.js:257:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async handleFunctionCallRequestMessage (file:///opt/render/project/src/deepgram.js:1222:7)
[2025-09-12T08:44:28.712Z] ✅ COMPLETED: handleFunctionCall for cancel_booking
    at async handleDeepgramMessageType (file:///opt/render/project/src/deepgram.js:1031:5)
    at async handleDeepgramMessage (file:///opt/render/project/src/deepgram.js:728:9)
    at async WebSocket.<anonymous> (file:///opt/render/project/src/server.js:174:13)
🔧 Continuing despite send error to maintain connection
[2025-09-12T08:44:31.441Z] ▶️ KEEPALIVE: Resumed after function processing
Deepgram WebSocket closed in initializeDeepgram. Code: 1000, Reason: Call ended
Deepgram WebSocket closed. Code: 1000, Reason: Call ended
Twilio WebSocket connection closed
📞 Logging call completion on close: CAeb1cbd6b30b9b5f3f6616c0df2ca7b02
✅ Call completion logged on close: CAeb1cbd6b30b9b5f3f6616c0df2ca7b02
🔌 Closing Deepgram connection and cleaning up resources
🔇 Silence tracking cleaned up
ℹ️ Deepgram connection already closed or not open
🗑️ Session cleared for call CAeb1cbd6b30b9b5f3f6616c0df2ca7b02