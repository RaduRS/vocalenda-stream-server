import WebSocket from "ws";
import url from "url";
import { initializeDeepgram } from "./deepgram.js";
import { handleFunctionCall } from "./functionHandlers.js";
import { loadBusinessConfig } from "./businessConfig.js";

/**
 * Handles WebSocket connection events and message processing
 * @param {WebSocket} ws - The WebSocket connection
 * @param {IncomingMessage} req - The HTTP request object
 * @param {Object} businessConfig - Business configuration object
 */
export function handleWebSocketConnection(ws, req) {
  console.log("New WebSocket connection established");

  // Parse query parameters
  const queryObject = url.parse(req.url, true).query;
  console.log("Query parameters:", queryObject);

  // Initialize connection state
  let deepgramWs = null;
  let deepgramReady = false;
  let expectingFunctionCall = false;
  let functionCallTimeout = null;
  let businessConfig = null;
  let businessId = null;
  let callSid = null;

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);
      const timestamp = new Date().toISOString();

      switch (data.event) {
        case "connected":
          console.log("Twilio connected");
          break;

        case "start":
          console.log("Media stream started:", data);
          console.log("Media format:", data.start?.mediaFormat);

          // Extract parameters from Twilio
          const customParameters = data.start?.customParameters || {};
          businessId = customParameters.business_id;
          callSid = customParameters.call_sid;

          if (!businessId) {
            console.error("No business_id provided");
            ws.close();
            return;
          }

          // Load business configuration
          businessConfig = await loadBusinessConfig(businessId);

          if (!businessConfig) {
            console.error("Failed to load business configuration");
            ws.close();
            return;
          }

          console.log(
            `Business configuration loaded for: ${businessConfig.business_name}`
          );

          // Extract call context from Twilio data
          const callContext = {
            callSid: data.start?.callSid,
            streamSid: data.start?.streamSid,
            from: data.start?.customParameters?.From,
            to: data.start?.customParameters?.To,
            accountSid: data.start?.accountSid,
          };

          console.log("Call context:", callContext);

          // Initialize Deepgram with business config and context
          deepgramWs = await initializeDeepgram(
            businessConfig,
            callContext,
            handleFunctionCall,
            () => {
              deepgramReady = true;
              console.log("🎉 Deepgram ready state updated: true");
            }
          );

          if (!deepgramWs) {
            console.error("Failed to initialize Deepgram connection");
            return;
          }

          // Handle Deepgram messages
          deepgramWs.on("message", async (deepgramMessage) => {
            try {
              // First check if this is binary data
              if (Buffer.isBuffer(deepgramMessage)) {
                // Quick binary detection - check first few bytes only for performance
                const sampleSize = Math.min(20, deepgramMessage.length); // Reduced sample size
                let nonPrintableCount = 0;
                for (let i = 0; i < sampleSize; i++) {
                  const byte = deepgramMessage[i];
                  if (byte < 32 || byte > 126) {
                    nonPrintableCount++;
                  }
                }
                
                // If more than 50% are non-printable, treat as binary audio
                if (nonPrintableCount / sampleSize > 0.5) {
                  // Reduce audio processing logs to prevent spam
                  if (Math.random() < 0.1) { // Log only 10% of audio messages
                    console.log(
                      `Processing binary audio data (${deepgramMessage.length} bytes)`
                    );
                  }

                  // Validate audio data integrity
                  if (deepgramMessage.length === 0) {
                    console.warn(
                      "⚠️ Received empty audio buffer from Deepgram"
                    );
                    return;
                  }

                  // If we're receiving audio, Deepgram is clearly ready
                  if (!deepgramReady) {
                    console.log(
                      "🎉 Deepgram is sending audio - marking as ready!"
                    );
                    deepgramReady = true;
                  }

                  // Validate that we have a valid stream ID
                  if (!data.start?.streamSid) {
                    console.warn(
                      "⚠️ No streamSid available for audio forwarding"
                    );
                    return;
                  }

                  // Forward binary audio data to Twilio
                  try {
                    const audioMessage = {
                      event: "media",
                      streamSid: data.start.streamSid,
                      media: {
                        payload: deepgramMessage.toString("base64"),
                      },
                    };
                    ws.send(JSON.stringify(audioMessage));
                  } catch (error) {
                    console.error(
                      "❌ Error forwarding audio to Twilio:",
                      error
                    );
                  }
                  return;
                }
              }
              
              // Convert to string for JSON parsing
              const messageStr = deepgramMessage.toString();
              
              // Additional check: if it doesn't look like JSON, treat as binary
              const trimmed = messageStr.trim();
              if (
                !trimmed.startsWith("{") &&
                !trimmed.startsWith("[") ||
                trimmed.length === 0
              ) {
                // Reduce non-JSON processing logs to prevent spam
                if (Math.random() < 0.1) { // Log only 10% of non-JSON messages
                  console.log(
                    `Processing non-JSON string data as binary audio (${deepgramMessage.length} bytes)`
                  );
                }
                return; // Skip processing malformed data
              }
              
              // Attempt JSON parsing with better error handling
              let deepgramData;
              try {
                deepgramData = JSON.parse(messageStr);
              } catch (parseError) {
                console.warn(
                  `⚠️ Skipping malformed JSON data (${deepgramMessage.length} bytes):`,
                  parseError.message
                );
                // Log first 100 chars for debugging without flooding logs
                const preview = messageStr.substring(0, 100);
                console.warn("Data preview:", preview + (messageStr.length > 100 ? "..." : ""));
                return;
              }

              // This is a JSON message - log it fully with timestamp
              console.log(
                `[${timestamp}] 📨 JSON MESSAGE FROM DEEPGRAM:`,
                messageStr
              );
              console.log(`[${timestamp}] === PARSED DEEPGRAM JSON ===`);
              console.log(JSON.stringify(deepgramData, null, 2));
              console.log(`[${timestamp}] === END PARSED JSON ===`);

              // Log the event type prominently
              console.log(
                `[${timestamp}] 🎯 DEEPGRAM EVENT TYPE: ${deepgramData.type}`
              );

              // Handle different types of Deepgram messages
              if (deepgramData.type === "SettingsApplied") {
                // Deepgram is now ready to receive audio (ready state handled via callback)
                console.log(
                  `[${timestamp}] ✅ SETTINGS_APPLIED: Deepgram ready to receive audio`
                );
                console.log(
                  `[${timestamp}] 🔧 Audio settings:`,
                  deepgramData.audio || "No audio settings"
                );
                console.log(
                  `[${timestamp}] 🤖 Agent config:`,
                  deepgramData.agent || "No agent config"
                );
                console.log(
                  `[${timestamp}] 🎙️ Agent ready with automatic greeting`
                );
              } else if (deepgramData.type === "Welcome") {
                console.log(
                  `[${timestamp}] ✅ WELCOME: Deepgram connection established`
                );
              } else if (deepgramData.type === "Results") {
                // Speech-to-text results
                const transcript =
                  deepgramData.channel?.alternatives?.[0]?.transcript;
                console.log(
                  `[${timestamp}] 📝 RESULTS: Transcript:`,
                  transcript
                );
                console.log(
                  `[${timestamp}] 🔍 Full Results:`,
                  JSON.stringify(deepgramData, null, 2)
                );

                // Enhanced detection for booking triggers
                if (transcript) {
                  const lowerTranscript = transcript.toLowerCase();
                  const bookingKeywords = [
                    "available",
                    "appointment",
                    "book",
                    "schedule",
                    "tomorrow",
                    "today",
                    "monday",
                    "tuesday",
                    "wednesday",
                    "thursday",
                    "friday",
                    "saturday",
                    "sunday",
                  ];
                  const namePattern = /my name is|i'm|i am|this is|call me/i;

                  const hasBookingKeyword = bookingKeywords.some((keyword) =>
                    lowerTranscript.includes(keyword)
                  );
                  const hasName =
                    namePattern.test(transcript) ||
                    /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(transcript);

                  if (hasBookingKeyword) {
                    console.log(
                      `[${timestamp}] 🎯 BOOKING_KEYWORD_DETECTED:`,
                      transcript
                    );
                    console.log(
                      `[${timestamp}] 🤖 EXPECTING: get_available_slots function call soon!`
                    );

                    // Set expectation for function call
                    expectingFunctionCall = true;

                    // Clear any existing timeout
                    if (functionCallTimeout) {
                      clearTimeout(functionCallTimeout);
                    }

                    // Set timeout to detect if function call doesn't happen
                    functionCallTimeout = setTimeout(() => {
                      if (expectingFunctionCall) {
                        console.log(
                          "🚨🚨 CRITICAL: AI FAILED TO CALL FUNCTION! 🚨🚨"
                        );
                        console.log(
                          "💡 Expected get_available_slots but AI responded with text instead"
                        );
                        console.log(
                          "🔧 This indicates the system prompt needs adjustment"
                        );
                        expectingFunctionCall = false;
                      }
                    }, 8000); // 8 second timeout
                  }

                  if (hasName) {
                    console.log(
                      `[${timestamp}] 👤 CUSTOMER_NAME_DETECTED:`,
                      transcript
                    );
                    console.log(
                      `[${timestamp}] 🚨 NEXT: Booking request should trigger function call!`
                    );
                  }
                }
              } else if (deepgramData.type === "SpeechStarted") {
                console.log(
                  `[${timestamp}] 🎤 SPEECH_STARTED: User began speaking`
                );
              } else if (deepgramData.type === "UtteranceEnd") {
                console.log(
                  `[${timestamp}] 🔇 UTTERANCE_END: User finished speaking`
                );
                console.log(
                  `[${timestamp}] 🧠 EXPECTING: AgentThinking → FunctionCall or TtsStart`
                );
              } else if (deepgramData.type === "TtsAudio") {
                console.log(
                  `[${timestamp}] 🔊 TTS_AUDIO: AI sending audio response (${
                    deepgramData.data?.length || 0
                  } chars)`
                );
                const audioMessage = {
                  event: "media",
                  streamSid: data.start?.streamSid,
                  media: {
                    payload: deepgramData.data,
                  },
                };
                ws.send(JSON.stringify(audioMessage));
              } else if (deepgramData.type === "AgentThinking") {
                console.log(
                  `[${timestamp}] 🧠 AGENT_THINKING: AI processing...`
                );
                console.log(
                  `[${timestamp}] 🔍 Thinking details:`,
                  deepgramData.text ||
                    deepgramData.content ||
                    deepgramData.thinking ||
                    "No thinking details"
                );
                console.log(
                  `[${timestamp}] ⏰ CRITICAL: Function calls should happen during thinking!`
                );
              } else if (deepgramData.type === "TtsStart") {
                console.log(
                  `[${timestamp}] 🎙️ TTS_START: AI generating speech...`
                );
              } else if (deepgramData.type === "TtsText") {
                console.log(
                  `[${timestamp}] 💬 TTS_TEXT: AI response:`,
                  deepgramData.text
                );
                // Check if AI is mentioning availability without calling function
                if (
                  deepgramData.text &&
                  (deepgramData.text.toLowerCase().includes("available") ||
                    deepgramData.text.toLowerCase().includes("check") ||
                    deepgramData.text.toLowerCase().includes("let me see"))
                ) {
                  console.log(
                    `[${timestamp}] 🚨 WARNING: AI mentioned availability but NO FUNCTION CALL detected!`
                  );
                }
              } else if (deepgramData.type === "AgentResponse") {
                console.log(
                  `[${timestamp}] 🤖 AGENT_RESPONSE:`,
                  deepgramData.response ||
                    deepgramData.text ||
                    "No response text"
                );
              } else if (deepgramData.type === "FunctionCall" || deepgramData.type === "FunctionCallRequest") {
                console.log(`[${timestamp}] 🚨🚨 FUNCTION_CALL DETECTED! 🚨🚨`);
                console.log(
                  `[${timestamp}] ✅ Function call will be handled by deepgram.js to prevent duplicates`
                );
                console.log(
                  `[${timestamp}] 🔧 Type:`,
                  deepgramData.type
                );
                
                // Clear expectation since function call happened
                expectingFunctionCall = false;
                if (functionCallTimeout) {
                  clearTimeout(functionCallTimeout);
                  functionCallTimeout = null;
                }
                
                // Note: Function call handling is done in deepgram.js to prevent duplicate bookings
              } else if (deepgramData.type === "Error") {
                console.error(
                  `[${timestamp}] ❌ DEEPGRAM_ERROR:`,
                  deepgramData
                );
              } else if (deepgramData.type === "Warning") {
                console.warn(
                  `[${timestamp}] ⚠️ DEEPGRAM_WARNING:`,
                  deepgramData
                );
              } else if (deepgramData.type === "ConversationText") {
                console.log(
                  `[${timestamp}] 💭 CONVERSATION_TEXT:`,
                  deepgramData.text || deepgramData.content
                );
              } else if (deepgramData.type === "FunctionResponse") {
                console.log(
                  `[${timestamp}] 📤 FUNCTION_RESPONSE: Sent back to agent`
                );
                console.log(
                  `[${timestamp}] 📋 Response data:`,
                  JSON.stringify(deepgramData, null, 2)
                );
              } else {
                console.log(
                  `[${timestamp}] ❓ UNKNOWN_EVENT_TYPE: ${deepgramData.type}`
                );
                console.log(
                  `[${timestamp}] 📦 Full message:`,
                  JSON.stringify(deepgramData, null, 2)
                );
              }
            } catch (error) {
              console.error("❌ Unexpected error in Deepgram message handler:", error);
              // Note: JSON parsing errors are now handled gracefully above
            }
          });

          deepgramWs.on("error", (error) => {
            console.error("Deepgram WebSocket error:", error);
            // Don't close the Twilio connection on Deepgram errors
            // Just log and continue
          });

          deepgramWs.on("close", (code, reason) => {
            console.log(
              `Deepgram WebSocket closed. Code: ${code}, Reason: ${reason}`
            );
            // Only close Twilio connection if it's an unexpected close
            if (code !== 1000 && code !== 1001) {
              console.error(
                "🚨 Unexpected Deepgram close - this may cause issues"
              );
            }
          });

          break;

        case "media":
          // Forward audio to Deepgram only when connection is ready
          if (
            deepgramWs &&
            deepgramWs.readyState === WebSocket.OPEN &&
            deepgramReady
          ) {
            // Quick validation - only check for payload existence
            if (!data.media?.payload) {
              return; // Silently skip invalid payloads to reduce log noise
            }

            try {
              // Convert base64 to buffer - minimal validation for performance
              const audioBuffer = Buffer.from(data.media.payload, "base64");
              
              // Only validate if buffer is empty (critical error)
              if (audioBuffer.length === 0) {
                return; // Silently skip empty buffers
              }

              // Send directly without size validation for better performance
              deepgramWs.send(audioBuffer);
            } catch (error) {
              // Only log critical errors to reduce noise
              if (error.message.includes('Invalid base64')) {
                console.error("❌ Invalid base64 audio data from Twilio");
              }
            }
          } else {
            // Reduce frequency of "cannot forward" messages to prevent log spam
            if (Math.random() < 0.01) { // Log only 1% of failed attempts
              console.log(
                `⚠️ Cannot forward audio - deepgramWs ready: ${
                  !!deepgramWs && deepgramWs.readyState === WebSocket.OPEN
                }, isReady: ${deepgramReady}`
              );
            }
          }
          break;

        case "stop":
          console.log("Media stream stopped");
          if (deepgramWs) {
            deepgramWs.close();
          }
          break;
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  });

  ws.on("close", () => {
    console.log("Twilio WebSocket connection closed");
    if (deepgramWs) {
      deepgramWs.close();
    }
  });

  ws.on("error", (error) => {
    console.error("Twilio WebSocket error:", error);
  });
}
