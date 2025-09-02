import WebSocket from "ws";
import { generateSystemPrompt, getAvailableFunctions } from "./utils.js";
import { validateConfig } from "./config.js";
import { handleFunctionCall } from "./functionHandlers.js";

// Get configuration
const config = validateConfig();

/**
 * Initialize Deepgram Voice Agent connection
 * @param {Object} businessConfig - Business configuration object
 * @param {Object} callContext - Call context information
 * @param {Function} handleFunctionCall - Function to handle function calls
 * @returns {Promise<WebSocket>} - Connected Deepgram WebSocket
 */
export async function initializeDeepgram(businessConfig, callContext) {
  return new Promise((resolve, reject) => {
    const deepgramWs = new WebSocket(
      "wss://agent.deepgram.com/v1/agent/converse",
      ["token", config.deepgram.apiKey]
    );

    deepgramWs.on("open", () => {
      console.log(
        "✅ Deepgram WebSocket connected successfully - waiting for Welcome message"
      );
      console.log("Connection readyState:", deepgramWs.readyState);
    });

    // Wait for Welcome message before sending configuration (like official example)
    deepgramWs.on("message", async (message) => {
      try {
        const timestamp = new Date().toISOString();
        const data = JSON.parse(message.toString());
        console.log(`[${timestamp}] 📨 INIT: Deepgram message:`, data.type);

        if (data.type === "Welcome") {
          console.log(
            `[${timestamp}] ✅ WELCOME: Received - sending agent configuration...`
          );

          // Generate system prompt
          const systemPrompt = generateSystemPrompt(
            businessConfig,
            callContext
          );

          console.log(
            `[${timestamp}] 📝 PROMPT: Generated length:`,
            systemPrompt.length,
            "characters"
          );
          console.log(
            `[${timestamp}] 📝 PROMPT: Preview (first 500 chars):`,
            systemPrompt.substring(0, 500) + "..."
          );
          console.log(`[${timestamp}] 🔧 PROMPT: Full content:`);
          console.log(systemPrompt);
          console.log(`[${timestamp}] 🔧 PROMPT: End of content`);
          console.log(
            `[${timestamp}] 🎯 PROMPT: Function calling rules included:`,
            systemPrompt.includes("get_available_slots")
          );

          const functionsArray = getAvailableFunctions();
          console.log(
            `[${timestamp}] 🔧 FUNCTIONS: Available count:`,
            Array.isArray(functionsArray) ? functionsArray.length : 0
          );

          const config = {
            type: "Settings",
            audio: {
              input: {
                encoding: "mulaw",
                sample_rate: 8000,
              },
              output: {
                encoding: "mulaw",
                sample_rate: 8000,
                container: "none",
              },
            },
            agent: {
              language: "en",
              listen: {
                provider: {
                  type: "deepgram",
                  model: "nova-3",
                },
              },
              think: {
                provider: {
                  type: "open_ai",
                  model: "gpt-4o-mini",
                },
                prompt: systemPrompt,
                functions: Array.isArray(functionsArray) ? functionsArray : [],
              },
              speak: {
                provider: {
                  type: "deepgram",
                  model: "aura-2-thalia-en",
                },
              },
              greeting: "Thank you for calling, how can I help you today?",
            },
          };

          console.log(`[${timestamp}] 📋 CONFIG: Summary:`);
          console.log(`[${timestamp}]    - Audio input: mulaw, 8000Hz`);
          console.log(`[${timestamp}]    - Audio output: mulaw, 8000Hz`);
          console.log(`[${timestamp}]    - Think model: gpt-4o-mini`);
          console.log(`[${timestamp}]    - Speak model: aura-2-thalia-en`);
          console.log(
            `[${timestamp}]    - Functions available:`,
            Array.isArray(functionsArray) ? functionsArray.length : 0
          );
          console.log(
            `[${timestamp}]    - Prompt length:`,
            systemPrompt?.length || 0,
            "characters"
          );

          // Validate config before sending
          if (!config.agent.think.prompt) {
            console.error(`[${timestamp}] ❌ CONFIG: Missing system prompt!`);
            reject(new Error("Missing system prompt"));
            return;
          }

          if (
            !config.agent.think.functions ||
            config.agent.think.functions.length === 0
          ) {
            console.error(`[${timestamp}] ❌ CONFIG: Missing functions!`);
            reject(new Error("Missing function definitions"));
            return;
          }

          console.log(
            `[${timestamp}] 📤 SENDING: Configuration to Deepgram...`
          );
          console.log(
            `[${timestamp}] 📦 CONFIG: Full payload:`,
            JSON.stringify(config, null, 2)
          );

          try {
            deepgramWs.send(JSON.stringify(config));
            console.log(
              `[${timestamp}] ✅ SENT: Configuration sent successfully to Deepgram`
            );
            console.log(
              `[${timestamp}] ⏳ WAITING: For SettingsApplied confirmation...`
            );
          } catch (configError) {
            console.error(
              `[${timestamp}] ❌ ERROR: Sending configuration to Deepgram:`,
              configError
            );
            reject(configError);
            return;
          }

          // Set up keep-alive messages to maintain connection
          // Track if we're processing function calls to avoid conflicts
          let processingFunctionCall = false;

          const keepAliveInterval = setInterval(() => {
            if (
              deepgramWs &&
              deepgramWs.readyState === WebSocket.OPEN &&
              !processingFunctionCall
            ) {
              deepgramWs.send(JSON.stringify({ type: "KeepAlive" }));
              console.log(
                `[${new Date().toISOString()}] 💓 KEEPALIVE: Sent to Deepgram`
              );
            } else if (processingFunctionCall) {
              console.log(
                `[${new Date().toISOString()}] ⏸️ KEEPALIVE: Skipped - processing function call`
              );
            } else {
              clearInterval(keepAliveInterval);
            }
          }, 5000);

          // Add function to control KeepAlive during function processing
          deepgramWs.pauseKeepAlive = () => {
            processingFunctionCall = true;
            console.log(
              `[${new Date().toISOString()}] ⏸️ KEEPALIVE: Paused for function processing`
            );
          };

          deepgramWs.resumeKeepAlive = () => {
            processingFunctionCall = false;
            console.log(
              `[${new Date().toISOString()}] ▶️ KEEPALIVE: Resumed after function processing`
            );
          };

          // Clean up interval when connection closes
          deepgramWs.on("close", () => {
            clearInterval(keepAliveInterval);
          });
        } else if (data.type === "SettingsApplied") {
          console.log(
            `[${timestamp}] ✅ SETTINGS_APPLIED: Agent configuration confirmed!`
          );
          console.log(
            `[${timestamp}] 🎯 READY: Agent ready for main message handler attachment`
          );
          console.log(
            `[${timestamp}] 🔧 APPLIED: Audio settings:`,
            data.audio || "No audio config"
          );
          console.log(
            `[${timestamp}] 🔧 APPLIED: Agent settings:`,
            data.agent || "No agent config"
          );

          // The handshake is complete. Resolve the promise and DO NOTHING ELSE.
          resolve(deepgramWs);
        }
      } catch (error) {
        const timestamp = new Date().toISOString();
        console.error(
          `[${timestamp}] ❌ INIT_ERROR: Processing message:`,
          error
        );
        reject(error);
      }
    });

    deepgramWs.on("error", (error) => {
      console.error("Deepgram WebSocket error in initializeDeepgram:", error);
      reject(error);
    });

    deepgramWs.on("close", (code, reason) => {
      console.log(
        `Deepgram WebSocket closed in initializeDeepgram. Code: ${code}, Reason: ${reason}`
      );
      if (code !== 1000) {
        reject(new Error(`WebSocket closed with code ${code}: ${reason}`));
      }
    });

    // Set a timeout for connection establishment
    setTimeout(() => {
      if (deepgramWs.readyState !== WebSocket.OPEN) {
        reject(new Error("Deepgram connection timeout"));
      }
    }, 10000); // 10 second timeout
  });
}

/**
 * Export cleanup function for external use
 */
export function cleanupAudioSystem() {
  cleanupPersistentPacer();
  audioBuffer = Buffer.alloc(0);
  streamSid = null;
  twilioWsRef = null;
}

/**
 * Handle Deepgram WebSocket messages
 * @param {Buffer|string} deepgramMessage - The message from Deepgram
 * @param {WebSocket} twilioWs - Twilio WebSocket connection
 * @param {WebSocket} deepgramWs - Deepgram WebSocket connection
 * @param {Object} businessConfig - Business configuration
 * @param {string} streamSid - Twilio stream ID
 * @param {Object} state - State object containing flags and timeouts
 * @returns {Promise<void>}
 */
// Persistent pacer system for continuous audio flow
let audioBuffer = Buffer.alloc(0); // Buffer for incoming audio data
let pacer = null; // Persistent 20ms interval timer
let streamSid = null; // Store streamSid for pacer access
let twilioWsRef = null; // Store Twilio WebSocket reference for pacer

// Audio constants for μ-law format (8kHz, 20ms frames)
const FRAME_SIZE = 160; // 20ms of 8kHz μ-law audio
const SILENCE_PAYLOAD = Buffer.alloc(FRAME_SIZE, 0xFF).toString('base64');

/**
 * Initialize the persistent pacer that sends audio packets every 20ms
 * @param {WebSocket} twilioWs - Twilio WebSocket connection
 * @param {string} streamId - Twilio stream ID
 */
export function initializePersistentPacer(twilioWs, streamId) {
  // Store references for pacer access
  twilioWsRef = twilioWs;
  streamSid = streamId;
  if (pacer) {
    clearInterval(pacer);
  }
  
  console.log('🎵 Initializing persistent pacer for continuous audio flow');
  
  pacer = setInterval(() => {
    if (!twilioWsRef || twilioWsRef.readyState !== WebSocket.OPEN || !streamSid) {
      return;
    }
    
    let payload;
    
    if (audioBuffer.length >= FRAME_SIZE) {
      // Send real audio if available
      const frame = audioBuffer.slice(0, FRAME_SIZE);
      audioBuffer = audioBuffer.slice(FRAME_SIZE);
      payload = frame.toString('base64');
    } else {
      // Send silence to keep the stream alive
      payload = SILENCE_PAYLOAD;
    }
    
    // Always send a media message to maintain continuous flow
    const audioMessage = {
      event: 'media',
      streamSid: streamSid,
      media: { payload: payload },
    };
    
    try {
      twilioWsRef.send(JSON.stringify(audioMessage));
    } catch (error) {
      console.error('❌ Error sending audio packet in pacer:', error);
    }
  }, 20); // 20ms interval for continuous flow
  
  console.log('✅ Persistent pacer initialized - sending packets every 20ms');
}

/**
 * Clean up the persistent pacer
 */
function cleanupPersistentPacer() {
  if (pacer) {
    clearInterval(pacer);
    pacer = null;
    console.log('🔇 Persistent pacer cleaned up');
  }
}

export async function handleDeepgramMessage(
  deepgramMessage,
  twilioWs,
  deepgramWs,
  businessConfig,
  streamSidParam,
  state
) {
  // Store references for pacer access (pacer is initialized once in server.js)
  streamSid = streamSidParam;
  twilioWsRef = twilioWs;
  
  const {
    expectingFunctionCall,
    functionCallTimeout,
    deepgramReady,
    setExpectingFunctionCall,
    setFunctionCallTimeout,
    setDeepgramReady,
  } = state;

  try {
    // Add timestamp to all logs
    const timestamp = new Date().toISOString();

    if (!Buffer.isBuffer(deepgramMessage)) {
      console.log("🔍 NON-BUFFER MESSAGE:", deepgramMessage.toString());
    }

    // Check if this is binary audio data
    if (Buffer.isBuffer(deepgramMessage)) {
      // Enhanced audio validation
      if (deepgramMessage.length === 0) {
        console.warn(`[${timestamp}] ⚠️ Received empty audio buffer from Deepgram`);
        return;
      }

      // Validate audio buffer size for mulaw 8kHz (should be consistent)
      if (deepgramMessage.length < 10) {
        console.warn(`[${timestamp}] ⚠️ Received suspiciously small audio buffer: ${deepgramMessage.length} bytes`);
        return;
      }

      // If we're receiving audio, Deepgram is clearly ready
      if (!deepgramReady) {
        console.log(`[${timestamp}] 🎉 Deepgram is sending audio - marking as ready!`);
        setDeepgramReady(true);
      }

      // Validate that we have a valid stream ID
      if (!streamSid) {
        console.warn(`[${timestamp}] ⚠️ No streamSid available for audio forwarding`);
        return;
      }

      // Simply add audio to buffer - the persistent pacer handles the rest
      try {
        audioBuffer = Buffer.concat([audioBuffer, deepgramMessage]);
        console.log(`[${timestamp}] 📥 Added ${deepgramMessage.length} bytes to audio buffer (total: ${audioBuffer.length})`);
      } catch (error) {
        console.error(`[${timestamp}] ❌ Error adding audio to buffer:`, error);
      }
      return;
    }

    // Log all non-binary messages for debugging
    console.log(
      "📨 Received Deepgram message:",
      deepgramMessage.toString().substring(0, 200) + "..."
    );

    // Try to parse as JSON for text messages
    const messageStr = deepgramMessage.toString();
    console.log("Message string:", messageStr);

    // Additional check: if it doesn't look like JSON, treat as binary
    if (
      !messageStr.trim().startsWith("{") &&
      !messageStr.trim().startsWith("[")
    ) {
      console.log(
        `Processing non-JSON data as binary audio (${deepgramMessage.length} bytes)`
      );

      // Validate audio data integrity
      if (deepgramMessage.length === 0) {
        console.warn("⚠️ Received empty non-JSON audio buffer from Deepgram");
        return;
      }

      // If we're receiving audio, Deepgram is clearly ready
      if (!deepgramReady) {
        console.log("🎉 Deepgram is sending audio - marking as ready!");
        setDeepgramReady(true);
      }

      // Validate that we have a valid stream ID
      if (!streamSid) {
        console.warn("⚠️ No streamSid available for non-JSON audio forwarding");
        return;
      }

      // This is likely binary audio data, add to buffer instead of sending directly
      try {
        audioBuffer = Buffer.concat([audioBuffer, deepgramMessage]);
        console.log(`📥 Added non-JSON audio to buffer: ${deepgramMessage.length} bytes (total: ${audioBuffer.length})`);
      } catch (error) {
        console.error("❌ Error adding non-JSON audio to buffer:", error);
      }
      return;
    }

    const deepgramData = JSON.parse(messageStr);

    // This is a JSON message - log it fully with timestamp
    console.log(`[${timestamp}] 📨 JSON MESSAGE FROM DEEPGRAM:`, messageStr);
    console.log(`[${timestamp}] === PARSED DEEPGRAM JSON ===`);
    console.log(JSON.stringify(deepgramData, null, 2));
    console.log(`[${timestamp}] === END PARSED JSON ===`);

    // Log the event type prominently
    console.log(`[${timestamp}] 🎯 DEEPGRAM EVENT TYPE: ${deepgramData.type}`);

    // Handle different types of Deepgram messages
    const context = {
      twilioWs,
      deepgramWs,
      businessConfig,
      streamSid,
      callSid: state.callSid,
      state: {
        expectingFunctionCall,
        functionCallTimeout,
        deepgramReady,
        setExpectingFunctionCall,
        setFunctionCallTimeout,
        setDeepgramReady,
      },
    };
    await handleDeepgramMessageType(deepgramData, timestamp, context);
  } catch (error) {
    console.error("❌ Error parsing Deepgram message:", error);
    console.error("Raw message:", deepgramMessage.toString());
  }
}

/**
 * Handle specific Deepgram message types
 * @param {Object} deepgramData - Parsed Deepgram message data
 * @param {string} timestamp - Current timestamp
 * @param {Object} context - Context object
 */
async function handleDeepgramMessageType(deepgramData, timestamp, context) {
  const { twilioWs, deepgramWs, businessConfig, streamSid, state } = context;

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
    state.setDeepgramReady(true);
    console.log(`[${timestamp}] 🎙️ Agent ready with automatic greeting`);
  } else if (deepgramData.type === "Welcome") {
    console.log(`[${timestamp}] ✅ WELCOME: Deepgram connection established`);
  } else if (deepgramData.type === "Results") {
    // Speech-to-text results
    const transcript = deepgramData.channel?.alternatives?.[0]?.transcript;
    console.log(`[${timestamp}] 📝 RESULTS: Transcript:`, transcript);
    console.log(
      `[${timestamp}] 🔍 Full Results:`,
      JSON.stringify(deepgramData, null, 2)
    );

    // Enhanced detection for booking triggers
    if (transcript) {
      await handleTranscriptAnalysis(transcript, timestamp, state);
    }
  } else if (deepgramData.type === "SpeechStarted") {
    console.log(`[${timestamp}] 🎤 SPEECH_STARTED: User began speaking`);
  } else if (deepgramData.type === "UtteranceEnd") {
    console.log(`[${timestamp}] 🔇 UTTERANCE_END: User finished speaking`);
    console.log(
      `[${timestamp}] 🧠 EXPECTING: AgentThinking → FunctionCall or TtsStart`
    );
  } else if (deepgramData.type === "TtsAudio") {
    console.log(
      `[${timestamp}] 🔊 TTS_AUDIO: AI sending audio response (${
        deepgramData.data?.length || 0
      } chars)`
    );
    
    // Enhanced audio validation and synchronization
     if (deepgramData.data && deepgramData.data.length > 0) {
       // Validate audio data quality
       const audioData = deepgramData.data;
       const isValidBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(audioData);
       
       if (!isValidBase64) {
         console.error(`[${timestamp}] ❌ Invalid base64 audio data received`);
         return;
       }
       
       // Check for suspiciously small audio chunks that might cause crackling
       if (audioData.length < 100) {
         console.warn(`[${timestamp}] ⚠️ Very small audio chunk (${audioData.length} chars) - potential crackling risk`);
       }
      // Add TTS audio to buffer - the persistent pacer handles sending
      try {
        const audioData = Buffer.from(deepgramData.data, 'base64');
        audioBuffer = Buffer.concat([audioBuffer, audioData]);
        console.log(`[${timestamp}] 📥 Added TTS audio to buffer: ${audioData.length} bytes (total: ${audioBuffer.length})`);
      } catch (error) {
        console.error(`[${timestamp}] ❌ Error adding TTS audio to buffer:`, error);
      }
    } else {
       console.warn(`[${timestamp}] ⚠️ Empty or invalid audio data received`);
     }
  } else if (deepgramData.type === "AgentAudioDone") {
    console.log(`[${timestamp}] 🔇 AGENT_AUDIO_DONE: AI finished sending audio`);
    
    // The pacer will automatically switch to sending silence once the buffer is empty.
    // No need to send extra silence here; the pacer's default state handles it.
    console.log(`[${timestamp}] ✅ Agent speech ended. Pacer will now send silence until next utterance.`);
  } else if (deepgramData.type === "AgentThinking") {
    console.log(`[${timestamp}] 🧠 AGENT_THINKING: AI processing...`);
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
    console.log(`[${timestamp}] 🎙️ TTS_START: AI generating speech...`);
  } else if (deepgramData.type === "TtsText") {
    console.log(`[${timestamp}] 💬 TTS_TEXT: AI response:`, deepgramData.text);
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
      deepgramData.response || deepgramData.text || "No response text"
    );
  } else if (deepgramData.type === "FunctionCall") {
    await handleFunctionCallMessage(deepgramData, timestamp, context);
  } else if (deepgramData.type === "FunctionCallRequest") {
    await handleFunctionCallRequestMessage(deepgramData, timestamp, context);
  } else if (deepgramData.type === "Error") {
    console.error(`[${timestamp}] ❌ DEEPGRAM_ERROR:`, deepgramData);
  } else if (deepgramData.type === "Warning") {
    console.warn(`[${timestamp}] ⚠️ DEEPGRAM_WARNING:`, deepgramData);
  } else if (deepgramData.type === "ConversationText") {
    console.log(
      `[${timestamp}] 💭 CONVERSATION_TEXT:`,
      deepgramData.text || deepgramData.content
    );
  } else if (deepgramData.type === "FunctionResponse") {
    console.log(`[${timestamp}] 📤 FUNCTION_RESPONSE: Sent back to agent`);
    console.log(
      `[${timestamp}] 📋 Response data:`,
      JSON.stringify(deepgramData, null, 2)
    );
  } else {
    console.log(`[${timestamp}] ❓ UNKNOWN_EVENT_TYPE: ${deepgramData.type}`);
    console.log(
      `[${timestamp}] 📦 Full message:`,
      JSON.stringify(deepgramData, null, 2)
    );
  }
}

/**
 * Handle transcript analysis for booking triggers
 * @param {string} transcript - The transcript text
 * @param {string} timestamp - Current timestamp
 * @param {Object} state - State object
 */
async function handleTranscriptAnalysis(transcript, timestamp, state) {
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
    console.log(`[${timestamp}] 🎯 BOOKING_KEYWORD_DETECTED:`, transcript);
    console.log(
      `[${timestamp}] 🤖 EXPECTING: get_available_slots function call soon!`
    );

    // Set expectation for function call
    state.setExpectingFunctionCall(true);

    // Clear any existing timeout
    if (state.functionCallTimeout) {
      clearTimeout(state.functionCallTimeout);
    }

    // Set timeout to detect if function call doesn't happen
    const timeout = setTimeout(() => {
      if (state.expectingFunctionCall) {
        console.log("🚨🚨 CRITICAL: AI FAILED TO CALL FUNCTION! 🚨🚨");
        console.log(
          "💡 Expected get_available_slots but AI responded with text instead"
        );
        console.log("🔧 This indicates the system prompt needs adjustment");
        state.setExpectingFunctionCall(false);
      }
    }, 8000); // 8 second timeout
    state.setFunctionCallTimeout(timeout);
  }

  if (hasName) {
    console.log(`[${timestamp}] 👤 CUSTOMER_NAME_DETECTED:`, transcript);
    console.log(
      `[${timestamp}] 🚨 NEXT: Booking request should trigger function call!`
    );
  }
}

/**
 * Handle FunctionCall message type
 * @param {Object} deepgramData - Deepgram message data
 * @param {string} timestamp - Current timestamp
 * @param {Object} context - Context object
 */
async function handleFunctionCallMessage(deepgramData, timestamp, context) {
  const { businessConfig, deepgramWs, state } = context;

  console.log(`[${timestamp}] 🚨🚨 FUNCTION_CALL DETECTED! 🚨🚨`);
  console.log(`[${timestamp}] ✅ SUCCESS: AI calling function as expected!`);
  console.log(`[${timestamp}] 🔧 Function:`, deepgramData.function_name);
  console.log(
    `[${timestamp}] 📋 Parameters:`,
    JSON.stringify(deepgramData.parameters, null, 2)
  );
  console.log(
    `[${timestamp}] 📦 Full payload:`,
    JSON.stringify(deepgramData, null, 2)
  );

  // Clear expectation since function call happened
  state.setExpectingFunctionCall(false);
  if (state.functionCallTimeout) {
    clearTimeout(state.functionCallTimeout);
    state.setFunctionCallTimeout(null);
  }

  if (deepgramWs && businessConfig) {
    console.log(`[${timestamp}] 🔧 CALLING: handleFunctionCall...`);
    await handleFunctionCall(
      deepgramWs,
      deepgramData,
      businessConfig,
      context.callSid,
      context.callerPhone
    );
    console.log(`[${timestamp}] ✅ COMPLETED: handleFunctionCall`);
  } else {
    console.error(
      `[${timestamp}] ❌ CANNOT handle function call - missing dependencies`
    );
    console.log(`[${timestamp}]    - deepgramWs:`, !!deepgramWs);
    console.log(`[${timestamp}]    - businessConfig:`, !!businessConfig);
  }
}

/**
 * Handle FunctionCallRequest message type
 * @param {Object} deepgramData - Deepgram message data
 * @param {string} timestamp - Current timestamp
 * @param {Object} context - Context object
 */
async function handleFunctionCallRequestMessage(
  deepgramData,
  timestamp,
  context
) {
  const { businessConfig, deepgramWs, state } = context;

  console.log(`[${timestamp}] 🚨🚨 FUNCTION_CALL_REQUEST DETECTED! 🚨🚨`);
  console.log(`[${timestamp}] ✅ SUCCESS: AI requesting function calls!`);
  console.log(
    `[${timestamp}] 📋 Functions:`,
    JSON.stringify(deepgramData.functions, null, 2)
  );

  // Clear expectation since function call happened
  state.setExpectingFunctionCall(false);
  if (state.functionCallTimeout) {
    clearTimeout(state.functionCallTimeout);
    state.setFunctionCallTimeout(null);
  }

  // Pause KeepAlive during function processing
  if (deepgramWs && deepgramWs.pauseKeepAlive) {
    deepgramWs.pauseKeepAlive();
  }

  // Process each function in the request
  for (const func of deepgramData.functions) {
    console.log(`[${timestamp}] 🔧 Processing function:`, func.name);

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
        businessConfig,
        context.callSid,
        context.callerPhone
      );
      console.log(
        `[${timestamp}] ✅ COMPLETED: handleFunctionCall for ${func.name}`
      );
    } else {
      console.error(
        `[${timestamp}] ❌ CANNOT handle function call - missing dependencies`
      );
      console.log(`[${timestamp}]    - deepgramWs:`, !!deepgramWs);
      console.log(`[${timestamp}]    - businessConfig:`, !!businessConfig);
    }
  }

  // Resume KeepAlive after function processing
  if (deepgramWs && deepgramWs.resumeKeepAlive) {
    deepgramWs.resumeKeepAlive();
  }
}

// Utility functions are now imported from utils.js module
