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
            handleFunctionCall
          );

          if (!deepgramWs) {
            console.error("Failed to initialize Deepgram connection");
            return;
          }

          // Handle Deepgram messages
          deepgramWs.on("message", async (deepgramMessage) => {
            try {
              const timestamp = new Date().toISOString();

              // 🚨 FIX: Better binary detection
              if (Buffer.isBuffer(deepgramMessage)) {
                const messageStr = deepgramMessage.toString('utf8');
                
                // Skip binary or malformed data
                if (deepgramMessage.length === 0 || 
                    messageStr.includes('\x00') || 
                    messageStr.includes('�') ||
                    (!messageStr.trim().startsWith('{') && !messageStr.trim().startsWith('['))) {
                  
                  // Forward audio to Twilio
                  if (data.start?.streamSid && deepgramReady) {
                    try {
                      const audioMessage = {
                        event: "media", 
                        streamSid: data.start.streamSid,
                        media: { payload: deepgramMessage.toString("base64") }
                      };
                      ws.send(JSON.stringify(audioMessage));
                    } catch (error) {
                      console.error("❌ Audio error:", error);
                    }
                  }
                  return;
                }

                // Try to parse JSON
                try {
                  deepgramData = JSON.parse(messageStr);
                } catch (parseError) {
                  console.warn("⚠️ JSON parse failed - treating as audio");
                  return;
                }
              } else {
                 // Handle non-buffer messages (shouldn't happen but just in case)
                 const messageStr = deepgramMessage.toString();
                 try {
                   deepgramData = JSON.parse(messageStr);
                 } catch (parseError) {
                   console.warn("⚠️ Non-buffer JSON parse failed - treating as audio");
                   return;
                 }
               }

              // This is a JSON message - log it fully with timestamp
              console.log(
                `[${timestamp}] 📨 JSON MESSAGE FROM DEEPGRAM:`,
                deepgramMessage.toString()
              );
              console.log(`[${timestamp}] === PARSED DEEPGRAM JSON ===`);
              console.log(JSON.stringify(deepgramData, null, 2));
              console.log(`[${timestamp}] === END PARSED JSON ===`);

              // Log the event type prominently
              console.log(
                `[${timestamp}] 🎯 DEEPGRAM EVENT TYPE: ${deepgramData.type}`
              );

              // 🚨 FIX: Filter out unwanted message types
              const ignoredTypes = ['History', 'UserStartedSpeaking', 'UserStoppedSpeaking', 'AgentAudioDone'];
              if (ignoredTypes.includes(deepgramData.type)) {
                console.log(`[${timestamp}] 🔇 IGNORED: ${deepgramData.type} - not processing`);
                return;
              }

              // Handle different types of Deepgram messages
              if (deepgramData.type === "SettingsApplied") {
                // Deepgram is now ready to receive audio
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
                deepgramReady = true;
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
              } else if (deepgramData.type === "FunctionCall") {
                console.log(`[${timestamp}] 🚨🚨 FUNCTION_CALL DETECTED! 🚨🚨`);
                console.log(
                  `[${timestamp}] ✅ SUCCESS: AI calling function as expected!`
                );
                console.log(
                  `[${timestamp}] 🔧 Function:`,
                  deepgramData.function_name
                );
                console.log(
                  `[${timestamp}] 📋 Parameters:`,
                  JSON.stringify(deepgramData.parameters, null, 2)
                );
                console.log(
                  `[${timestamp}] 📦 Full payload:`,
                  JSON.stringify(deepgramData, null, 2)
                );

                // Clear expectation since function call happened
                expectingFunctionCall = false;
                if (functionCallTimeout) {
                  clearTimeout(functionCallTimeout);
                  functionCallTimeout = null;
                }

                if (deepgramWs && businessConfig) {
                  console.log(
                    `[${timestamp}] 🔧 CALLING: handleFunctionCall...`
                  );
                  await handleFunctionCall(
                    deepgramWs,
                    deepgramData,
                    businessConfig
                  );
                  console.log(
                    `[${timestamp}] ✅ COMPLETED: handleFunctionCall`
                  );
                } else {
                  console.error(
                    `[${timestamp}] ❌ CANNOT handle function call - missing dependencies`
                  );
                  console.log(`[${timestamp}]    - deepgramWs:`, !!deepgramWs);
                  console.log(
                    `[${timestamp}]    - businessConfig:`,
                    !!businessConfig
                  );
                }
              } else if (deepgramData.type === "FunctionCallRequest") {
                console.log(
                  `[${timestamp}] 🚨🚨 FUNCTION_CALL_REQUEST DETECTED! 🚨🚨`
                );
                console.log(
                  `[${timestamp}] ✅ SUCCESS: AI requesting function calls!`
                );
                console.log(
                  `[${timestamp}] 📋 Functions:`,
                  JSON.stringify(deepgramData.functions, null, 2)
                );

                // Clear expectation since function call happened
                expectingFunctionCall = false;
                if (functionCallTimeout) {
                  clearTimeout(functionCallTimeout);
                  functionCallTimeout = null;
                }

                // Pause KeepAlive during function processing
                if (deepgramWs && deepgramWs.pauseKeepAlive) {
                  deepgramWs.pauseKeepAlive();
                }

                // Process each function in the request
                for (const func of deepgramData.functions) {
                  console.log(
                    `[${timestamp}] 🔧 Processing function:`,
                    func.name
                  );

                  // Create the function call data in the expected format
                  const functionCallData = {
                    function_name: func.name,
                    function_call_id: func.id,
                    parameters: JSON.parse(func.arguments),
                  };

                  if (deepgramWs && businessConfig) {
                    console.log(
                      `[${timestamp}] 🔧 CALLING: handleFunctionCall for ${func.name}...`
                    );
                    await handleFunctionCall(
                      deepgramWs,
                      functionCallData,
                      businessConfig
                    );
                    console.log(
                      `[${timestamp}] ✅ COMPLETED: handleFunctionCall for ${func.name}`
                    );
                  } else {
                    console.error(
                      `[${timestamp}] ❌ CANNOT handle function call - missing dependencies`
                    );
                    console.log(
                      `[${timestamp}]    - deepgramWs:`,
                      !!deepgramWs
                    );
                    console.log(
                      `[${timestamp}]    - businessConfig:`,
                      !!businessConfig
                    );
                  }
                }

                // Resume KeepAlive after function processing
                if (deepgramWs && deepgramWs.resumeKeepAlive) {
                  deepgramWs.resumeKeepAlive();
                }
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
              console.error("❌ Error parsing Deepgram message:", error);
              console.error("Raw message:", deepgramMessage.toString());
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
            // Validate incoming audio data
            if (!data.media?.payload) {
              console.warn("⚠️ Received media event without payload");
              return;
            }

            try {
              // Convert base64 to buffer and validate
              const audioBuffer = Buffer.from(data.media.payload, "base64");

              if (audioBuffer.length === 0) {
                console.warn("⚠️ Received empty audio buffer from Twilio");
                return;
              }

              // Validate buffer size (Twilio sends 160 bytes for 8kHz mulaw)
              if (audioBuffer.length !== 160) {
                console.warn(
                  `⚠️ Unexpected audio buffer size: ${audioBuffer.length} bytes (expected 160)`
                );
              }

              deepgramWs.send(audioBuffer);
            } catch (error) {
              console.error("❌ Error processing audio from Twilio:", error);
            }
          } else {
            console.log(
              `⚠️ Cannot forward audio - deepgramWs ready: ${
                !!deepgramWs && deepgramWs.readyState === WebSocket.OPEN
              }, isReady: ${deepgramReady}`
            );
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
