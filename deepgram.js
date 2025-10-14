import WebSocket from "ws";
import { generateSystemPrompt, getAvailableFunctions } from "./utils.js";
import { getCurrentUKDateTime, getShortTimestamp } from "./dateUtils.js";
import { validateConfig } from "./config.js";
import { handleFunctionCall } from "./functionHandlers.js";
import { db, supabase } from "./database.js";
import { ConnectionState } from "./managers/ConnectionState.js";

/**
 * Replace variables in greeting message with actual values
 * @param {string} greeting - The greeting template with variables
 * @param {Object} businessConfig - Business configuration
 * @param {string} callerPhone - Caller's phone number
 * @returns {Promise<string>} - Greeting with variables replaced
 */
async function replaceGreetingVariables(greeting, businessConfig, callerPhone) {
  if (!greeting) return { greeting, customerName: null };

  let processedGreeting = greeting;
  let customerName = null;

  // Replace business name
  const businessName = businessConfig?.business?.name || "our business";
  processedGreeting = processedGreeting.replace(
    /{business_name}/g,
    businessName
  );

  // Replace customer name if caller phone is available
  if (callerPhone && processedGreeting.includes("{customer_name}")) {
    try {
      // Look up customer by phone number in customer table
      const { data: existingCustomers } = await supabase
        .from("customers")
        .select("first_name, last_name")
        .eq("phone", callerPhone)
        .eq("business_id", businessConfig?.business?.id)
        .not("first_name", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (existingCustomers && existingCustomers.length > 0) {
        const customer = existingCustomers[0];
        customerName =
          customer.first_name +
          (customer.last_name ? ` ${customer.last_name}` : "");
        processedGreeting = processedGreeting.replace(
          /{customer_name}/g,
          customerName
        );
      } else {
        // If no customer found, remove the {customer_name} variable
        processedGreeting = processedGreeting.replace(/{customer_name}/g, "");
        // Clean up any extra spaces or punctuation that might result
        processedGreeting = processedGreeting.replace(/Hi\s*!/g, "Hi!");
        processedGreeting = processedGreeting.replace(/\s+/g, " ").trim();
      }
    } catch (error) {
      console.error("Error looking up customer for greeting:", error);
      // Fallback: remove the variable
      processedGreeting = processedGreeting.replace(/{customer_name}/g, "");
      processedGreeting = processedGreeting.replace(/Hi\s*!/g, "Hi!");
      processedGreeting = processedGreeting.replace(/\s+/g, " ").trim();
    }
  }

  return { greeting: processedGreeting, customerName };
}

// Get configuration
const config = validateConfig();

// Manager classes are now in separate files for better modularity
// See ./managers/ directory for AudioStreamManager, SilenceDetectionManager, TranscriptManager, and ConnectionState

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

    // Create isolated connection state for this WebSocket
    const connectionState = new ConnectionState(callContext.callSid);
    deepgramWs.connectionState = connectionState;

    deepgramWs.on("open", () => {
      console.log(
        "✅ Deepgram WebSocket connected successfully - waiting for Welcome message"
      );
      console.log("Connection readyState:", deepgramWs.readyState);
    });

    // Wait for Welcome message before sending configuration (like official example)
    const initMessageHandler = async (message) => {
      try {
        const timestamp = getShortTimestamp();

        // Check if this is binary data (audio) vs JSON message
        if (message instanceof Buffer && message.length > 0) {
          // First check: if it's clearly not text-based, skip it
          if (
            message.length > 100 &&
            !message.toString("utf8", 0, 10).includes("{")
          ) {
            return;
          }

          const messageStr = message.toString("utf8");

          // Check if it looks like JSON by examining the content
          if (
            !messageStr.trim().startsWith("{") &&
            !messageStr.trim().startsWith("[")
          ) {
            // This is binary audio data, not a JSON message
            console.log(
              `[${timestamp}] 🔊 INIT: Ignoring non-JSON data (${message.length} bytes)`
            );
            return;
          }

          // Additional check for binary patterns and invalid UTF-8
          if (
            messageStr.includes("\x00") ||
            messageStr.includes("\xFF") ||
            messageStr.includes("�") ||
            // eslint-disable-next-line no-control-regex
            /[\x00-\x08\x0E-\x1F\x7F-\xFF]/.test(messageStr)
          ) {
            // Contains binary characters, ignore it in initialization
            console.log(
              `[${timestamp}] 🔊 INIT: Ignoring binary data in initialization (${message.length} bytes)`
            );
            return;
          }
        }

        const data = JSON.parse(message.toString());
        console.log(`[${timestamp}] 📨 INIT: Deepgram message:`, data.type);

        if (data.type === "Welcome") {
          console.log(
            `[${timestamp}] ✅ WELCOME: Received - sending agent configuration...`
          );

          // First, extract customer name from greeting to include in system prompt
          const greetingSource =
            businessConfig.business?.ai_greeting ||
            "Thank you for calling, how can I help you today?";

          const { greeting, customerName } = await replaceGreetingVariables(
            greetingSource,
            businessConfig,
            callContext.callerPhone
          );

          // Store customer name in call context
          if (customerName) {
            callContext.customerName = customerName;
          }

          // Generate system prompt with customer context
          const systemPrompt = generateSystemPrompt(
            businessConfig,
            callContext
          );

          // Get dynamic date variables for function descriptions
          const todayUK = getCurrentUKDateTime();
          const currentYear = todayUK.getFullYear();
          const currentMonth = todayUK.toLocaleString("en-GB", {
            month: "long",
          });

          const functionsArray = getAvailableFunctions(
            currentYear,
            currentMonth
          );
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
                  model: "gpt-4.1-mini",
                },
                prompt: systemPrompt,
                functions: Array.isArray(functionsArray) ? functionsArray : [],
              },
              speak: {
                provider: {
                  type: "deepgram",
                  model: businessConfig.config?.ai_voice || "aura-2-thalia-en",
                },
              },
              greeting: greeting,
            },
          };

          console.log(`[${timestamp}] 📋 CONFIG: Summary:`);
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
          // Deepgram requires KeepAlive messages every 3-5 seconds to prevent NET-0001 timeouts
          let processingFunctionCall = false;
          let hasActiveTwilioConnection = false;

          const keepAliveInterval = setInterval(() => {
            if (
              deepgramWs &&
              deepgramWs.readyState === WebSocket.OPEN &&
              !processingFunctionCall &&
              hasActiveTwilioConnection
            ) {
              deepgramWs.send(JSON.stringify({ type: "KeepAlive" }));
              console.log(
                `[${getShortTimestamp()}] 💓 KEEPALIVE: Sent to Deepgram`
              );
            }
          }, 4000); // Send every 4 seconds as recommended by Deepgram (3-5 second range)

          // Add function to control KeepAlive during function processing
          deepgramWs.pauseKeepAlive = () => {
            processingFunctionCall = true;
            console.log(
              `[${getShortTimestamp()}] ⏸️ KEEPALIVE: Paused for function processing`
            );
          };

          deepgramWs.resumeKeepAlive = () => {
            processingFunctionCall = false;
            console.log(
              `[${getShortTimestamp()}] ▶️ KEEPALIVE: Resumed after function processing`
            );
          };

          // Add functions to control KeepAlive based on Twilio connection status
          deepgramWs.setTwilioConnectionActive = (active) => {
            hasActiveTwilioConnection = active;
            console.log(
              `[${getShortTimestamp()}] 🔗 TWILIO_CONNECTION: ${
                active ? "Active" : "Inactive"
              } - KeepAlive ${active ? "enabled" : "disabled"}`
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
            `[${timestamp}] 🎯 READY: Agent can now handle conversations and function calls`
          );
          console.log(
            `[${timestamp}] 🔧 APPLIED: Audio settings:`,
            data.audio || "No audio config"
          );
          console.log(
            `[${timestamp}] 🔧 APPLIED: Agent settings:`,
            data.agent || "No agent config"
          );

          // Remove the initialization message handler to prevent duplicate processing
          deepgramWs.removeListener("message", initMessageHandler);

          // Resolve the promise with the connected WebSocket
          resolve(deepgramWs);
        } else if (data.type === "FunctionCallRequest") {
          // Function calls during initialization should be handled by the main message handler
          // to avoid duplicate processing. Just log and ignore here.
          console.log(
            `[${timestamp}] 📨 FUNCTION_CALL_REQUEST during init - will be handled by main message handler`
          );
        } else {
          // Only log non-initialization messages, don't process them
          // These will be handled by the main handleDeepgramMessage function
          if (
            data.type !== "ConversationText" &&
            data.type !== "History" &&
            data.type !== "UserStartedSpeaking" &&
            data.type !== "TtsAudio"
          ) {
            console.log(
              `[${timestamp}] 📨 OTHER: Initialization message type:`,
              data.type
            );
            console.log(
              `[${timestamp}] 📦 OTHER: Full data:`,
              JSON.stringify(data, null, 2)
            );
          }
          // Ignore ConversationText, History, UserStartedSpeaking, and TtsAudio during initialization
          // These will be processed by the main message handler after initialization completes
        }
      } catch (_error) {
        const timestamp = getShortTimestamp();
        console.error(
          `[${timestamp}] ❌ INIT_ERROR: Processing message:`,
          _error
        );
        reject(_error);
      }
    };

    // Register the initialization message handler
    deepgramWs.on("message", initMessageHandler);

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
 * @param {WebSocket} deepgramWs - Deepgram WebSocket with connectionState
 */
export function cleanupAudioSystem(deepgramWs) {
  const connectionState = deepgramWs?.connectionState;
  if (!connectionState) {
    console.warn("⚠️ No connection state found for audio cleanup");
    return;
  }

  // Don't cleanup the persistent pacer to maintain continuous audio flow
  // Just reset the audio buffer and streaming state
  const audioManager = connectionState.audioManager;
  audioManager.resetBuffer();
  audioManager.setStreamingState(false);
  if (audioManager.audioStreamTimeout) {
    clearTimeout(audioManager.audioStreamTimeout);
    audioManager.audioStreamTimeout = null;
  }
  // Keep streamSid and twilioWsRef to maintain the connection
  // This allows the pacer to continue sending silence between utterances
}

/**
 * Close Deepgram connection and cleanup all resources
 * @param {WebSocket} deepgramWs - Deepgram WebSocket connection to close
 */
export function closeDeepgramConnection(deepgramWs) {
  console.log("🔌 Closing Deepgram connection and cleaning up resources");

  const connectionState = deepgramWs?.connectionState;
  if (connectionState) {
    // Clean up audio system
    cleanupAudioSystem(deepgramWs);

    // Clean up persistent pacer
    cleanupPersistentPacer(connectionState);

    // Clean up silence tracking using connection state
    connectionState.silenceManager.cleanup();
    console.log("🔇 Silence tracking cleaned up");

    // Clean up all connection state
    connectionState.cleanup();
  } else {
    console.warn("⚠️ No connection state found for cleanup");
  }

  // Clear KeepAlive interval if it exists
  if (deepgramWs && deepgramWs.keepAliveInterval) {
    clearInterval(deepgramWs.keepAliveInterval);
    deepgramWs.keepAliveInterval = null;
  }

  // Close the WebSocket connection
  if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
    deepgramWs.close(1000, "Call ended");
    console.log("✅ Deepgram connection closed successfully");
  } else {
    console.log("ℹ️ Deepgram connection already closed or not open");
  }
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
// Legacy global transcript tracking - kept for backward compatibility
// New connections should use ConnectionState.transcriptManager instead
let conversationTranscript = [];
let currentCallSid = null;

/**
 * Initialize transcript tracking for a new call
 */
export function initializeTranscriptTracking(callSid) {
  currentCallSid = callSid;
  conversationTranscript = [];
  console.log(`📝 Initialized transcript tracking for call: ${callSid}`);
}

/**
 * Save the accumulated transcript to the database
 * @param {string} callSid - The call SID to save transcript for
 * @param {Object} deepgramWs - Optional Deepgram WebSocket with connectionState
 */
export async function saveConversationTranscript(
  callSid = null,
  deepgramWs = null
) {
  // Try to use connection-specific transcript first
  if (deepgramWs?.connectionState?.transcriptManager) {
    const transcriptManager = deepgramWs.connectionState.transcriptManager;
    const transcript = transcriptManager.getTranscript();
    const targetCallSid = callSid || transcriptManager.getCallSid();

    if (targetCallSid && transcript.length > 0) {
      try {
        const transcriptText = transcript
          .map(
            (entry) => `[${entry.timestamp}] ${entry.speaker}: ${entry.text}`
          )
          .join("\n");

        await db.updateCallTranscript(targetCallSid, transcriptText);
        console.log(
          `✅ Saved transcript for call ${targetCallSid} (${transcript.length} entries)`
        );

        // Clear the transcript after saving
        transcriptManager.clear();
        return;
      } catch (_error) {
        console.error(
          `❌ Failed to save transcript for call ${targetCallSid}:`,
          _error
        );
        return;
      }
    }
  }

  // Fallback to legacy global transcript (for backward compatibility)
  const targetCallSid = callSid || currentCallSid;
  if (targetCallSid && conversationTranscript.length > 0) {
    try {
      const transcriptText = conversationTranscript
        .map((entry) => `[${entry.timestamp}] ${entry.speaker}: ${entry.text}`)
        .join("\n");

      await db.updateCallTranscript(targetCallSid, transcriptText);
      console.log(
        `✅ Saved legacy transcript for call ${targetCallSid} (${conversationTranscript.length} entries)`
      );

      // Reset for next call
      conversationTranscript = [];
      currentCallSid = null;
    } catch (error) {
      console.error(
        `❌ Failed to save legacy transcript for call ${targetCallSid}:`,
        error
      );
    }
  }
}

/**
 * Initialize the persistent pacer that sends audio packets every 20ms
 * @param {ConnectionState} connectionState - Connection-specific state
 */
function initializePersistentPacer(connectionState) {
  const audioManager = connectionState.audioManager;

  if (audioManager.pacer) {
    clearInterval(audioManager.pacer);
  }

  console.log(
    "🎵 Initializing persistent pacer for continuous audio flow (120ms intervals)"
  );

  audioManager.pacer = setInterval(() => {
    if (
      !audioManager.twilioWsRef ||
      audioManager.twilioWsRef.readyState !== WebSocket.OPEN ||
      !audioManager.streamSid
    ) {
      return;
    }

    let payload;

    if (audioManager.audioBuffer.length >= audioManager.FRAME_SIZE) {
      // Send real audio if available
      const frame = audioManager.audioBuffer.slice(0, audioManager.FRAME_SIZE);
      audioManager.audioBuffer = audioManager.audioBuffer.slice(
        audioManager.FRAME_SIZE
      );
      payload = frame.toString("base64");
    } else {
      // Send silence to keep the stream alive
      payload = audioManager.SILENCE_PAYLOAD;
    }

    // Always send a media message to maintain continuous flow
    const audioMessage = {
      event: "media",
      streamSid: audioManager.streamSid,
      media: { payload: payload },
    };

    try {
      audioManager.twilioWsRef.send(JSON.stringify(audioMessage));
    } catch (error) {
      console.error("❌ Error sending audio packet in pacer:", error);
    }
  }, 120); // 120ms interval to match Deepgram's chunk size

  console.log("✅ Persistent pacer initialized - sending packets every 120ms");
}

/**
 * Clean up the persistent pacer
 * @param {ConnectionState} connectionState - Connection-specific state
 */
function cleanupPersistentPacer(connectionState) {
  const audioManager = connectionState.audioManager;
  if (audioManager.pacer) {
    clearInterval(audioManager.pacer);
    audioManager.pacer = null;
    console.log("🔇 Persistent pacer cleaned up");
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
  // Get connection-specific state
  const connectionState = deepgramWs.connectionState;
  if (!connectionState) {
    console.error("❌ No connection state found on deepgramWs");
    return;
  }

  // Store references for pacer access in connection state
  connectionState.audioManager.setStreamReferences(streamSidParam, twilioWs);

  // Initialize persistent pacer if not already running
  if (!connectionState.audioManager.pacer && streamSidParam && twilioWs) {
    initializePersistentPacer(connectionState);
  }

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
    const timestamp = getShortTimestamp();

    if (!Buffer.isBuffer(deepgramMessage)) {
      console.log("🔍 NON-BUFFER MESSAGE:", deepgramMessage.toString());
    }

    // First, try to determine if this is JSON or binary audio data
    // All messages from Deepgram come as Buffers, so we need to check the content
    let isJsonMessage = false;
    let messageStr = "";

    if (Buffer.isBuffer(deepgramMessage)) {
      try {
        messageStr = deepgramMessage.toString("utf8");
        // Check if it looks like JSON
        if (
          messageStr.trim().startsWith("{") ||
          messageStr.trim().startsWith("[")
        ) {
          // Try to parse as JSON to confirm
          JSON.parse(messageStr);
          isJsonMessage = true;
        }
      } catch {
        // Not valid JSON, treat as binary audio data
        isJsonMessage = false;
      }
    }

    // Handle binary audio data
    if (Buffer.isBuffer(deepgramMessage) && !isJsonMessage) {
      // Enhanced audio validation
      if (deepgramMessage.length === 0) {
        console.warn(
          `[${timestamp}] ⚠️ Received empty audio buffer from Deepgram`
        );
        return;
      }

      // Validate audio buffer size for mulaw 8kHz (should be consistent)
      if (deepgramMessage.length < 10) {
        console.warn(
          `[${timestamp}] ⚠️ Received suspiciously small audio buffer: ${deepgramMessage.length} bytes`
        );
        return;
      }

      // If we're receiving audio, Deepgram is clearly ready
      if (!deepgramReady) {
        console.log(
          `[${timestamp}] 🎉 Deepgram is sending audio - marking as ready!`
        );
        setDeepgramReady(true);
      }

      // Validate that we have a valid stream ID
      if (!streamSidParam) {
        console.warn(
          `[${timestamp}] ⚠️ No streamSidParam available for audio forwarding`
        );
        return;
      }

      // Feed audio buffer instead of sending directly (persistent pacer handles sending)
      try {
        const audioManager = connectionState.audioManager;

        // Mark that we're actively streaming audio
        if (!audioManager.isStreamingAudio) {
          audioManager.setStreamingState(true);
          console.log(
            `[${timestamp}] 🎵 Starting audio stream - feeding buffer`
          );
        }

        // Clear any existing timeout
        if (audioManager.audioStreamTimeout) {
          clearTimeout(audioManager.audioStreamTimeout);
        }

        // Add incoming audio to buffer instead of sending directly
        // Apply fade-in to first chunk of audio to prevent crackling at the beginning
        if (!audioManager.isStreamingAudio) {
          // This is the first chunk of a new audio stream - apply fade-in
          const fadeInBuffer = Buffer.from(deepgramMessage);
          // Apply fade-in over first 240 samples (30ms) of first chunk
          const fadeLength = Math.min(240, fadeInBuffer.length);
          for (let i = 0; i < fadeLength; i++) {
            // Gradually increase volume from 0 to full
            const fadeRatio = i / fadeLength;
            // μ-law is non-linear, so we need to adjust the value carefully
            // Start closer to silence (0xFF) and gradually move to the actual value
            const originalValue = fadeInBuffer[i];
            const silenceValue = 0xff;
            fadeInBuffer[i] = Math.round(
              silenceValue - fadeRatio * (silenceValue - originalValue)
            );
          }
          audioManager.appendToBuffer(fadeInBuffer);
          // console.log(`[${timestamp}] 📥 Added ${deepgramMessage.length} bytes to audio buffer with fade-in (total: ${audioManager.audioBuffer.length})`);
        } else {
          // Normal audio chunk - add directly
          audioManager.appendToBuffer(deepgramMessage);
          // console.log(`[${timestamp}] 📥 Added ${deepgramMessage.length} bytes to audio buffer (total: ${audioManager.audioBuffer.length})`);
        }

        // Set timeout to detect end of audio stream
        audioManager.audioStreamTimeout = setTimeout(() => {
          if (audioManager.isStreamingAudio) {
            console.log(`[${timestamp}] 🔇 Audio stream ended (timeout)`);
            audioManager.setStreamingState(false);
          }
        }, 500); // 500ms timeout to detect stream end
      } catch (error) {
        console.error(`[${timestamp}] ❌ Error adding audio to buffer:`, error);
      }
      return;
    }

    // Handle JSON messages
    if (isJsonMessage) {
      console.log("📨 Message string:", messageStr);

      try {
        const deepgramData = JSON.parse(messageStr);

        // Log the event type prominently
        console.log(`[${timestamp}] 🎯 DEEPGRAM: ${deepgramData.type}`);

        // Handle different types of Deepgram messages
        const context = {
          twilioWs,
          deepgramWs,
          businessConfig,
          streamSid: streamSidParam,
          callSid: state.callSid,
          callerPhone: state.callerPhone,
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
        console.error("❌ Error parsing Deepgram JSON message:", error);
        console.error("Raw message:", messageStr);
      }
    } else {
      // This should not happen since we already handled binary data above
      console.warn(
        "⚠️ Received non-buffer, non-JSON message from Deepgram:",
        deepgramMessage
      );
    }
  } catch (error) {
    console.error("❌ Error processing Deepgram message:", error);
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
  const { twilioWs, deepgramWs, streamSid, state } = context;
  const connectionState = deepgramWs.connectionState;

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

    // Add user speech to transcript using connection state
    if (transcript && transcript.trim()) {
      connectionState.addTranscriptEntry("User", transcript, timestamp);
    }

    // Enhanced detection for booking triggers
    if (transcript) {
      await handleTranscriptAnalysis(transcript, timestamp, state);
    }
  } else if (deepgramData.type === "UserStartedSpeaking") {
    console.log(`[${timestamp}] 🎤 USER_STARTED_SPEAKING: User began speaking`);

    // Handle barge-in: Clear Twilio audio queue when user starts speaking
    if (twilioWs && streamSid && twilioWs.readyState === WebSocket.OPEN) {
      const clearMessage = {
        event: "clear",
        streamSid: streamSid,
      };
      twilioWs.send(JSON.stringify(clearMessage));
      console.log(
        `[${timestamp}] 🔄 BARGE_IN: Cleared Twilio audio queue for user speech`
      );
    }

    // Clear local audio buffer to stop AI from continuing to speak
    connectionState.audioManager.resetBuffer();
    connectionState.audioManager.setStreamingState(false);
    console.log(
      `[${timestamp}] 🔄 BARGE_IN: Cleared local audio buffer and stopped streaming`
    );

    // Reset silence tracking when user starts speaking using connection state
    connectionState.silenceManager.resetTimer();
    console.log(
      `[${timestamp}] 🔄 SILENCE_RESET: User speaking, silence tracking reset`
    );
  } else if (deepgramData.type === "SpeechStarted") {
    console.log(
      `[${timestamp}] 🎤 SPEECH_STARTED: User began speaking (STT event)`
    );

    // Handle barge-in: Clear Twilio audio queue when user starts speaking
    if (twilioWs && streamSid && twilioWs.readyState === WebSocket.OPEN) {
      const clearMessage = {
        event: "clear",
        streamSid: streamSid,
      };
      twilioWs.send(JSON.stringify(clearMessage));
      console.log(
        `[${timestamp}] 🔄 BARGE_IN: Cleared Twilio audio queue for user speech`
      );
    }

    // Clear local audio buffer to stop AI from continuing to speak
    connectionState.audioManager.resetBuffer();
    connectionState.audioManager.setStreamingState(false);
    console.log(
      `[${timestamp}] 🔄 BARGE_IN: Cleared local audio buffer and stopped streaming`
    );

    // Reset silence tracking when user starts speaking using connection state
    connectionState.silenceManager.resetTimer();
    console.log(
      `[${timestamp}] 🔄 SILENCE_RESET: User speaking, silence tracking reset`
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
        console.warn(
          `[${timestamp}] ⚠️ Very small audio chunk (${audioData.length} chars) - potential crackling risk`
        );
      }
      // Mark that we're actively streaming audio using connection state
      if (!connectionState.audioManager.isStreamingAudio) {
        connectionState.audioManager.setStreamingState(true);
        console.log(`[${timestamp}] 🎵 Starting audio stream`);
      }

      // Clear any existing timeout since we're getting new audio
      connectionState.audioManager.clearStreamTimeout();

      // Add TTS audio to buffer instead of sending directly (persistent pacer handles sending)
      try {
        const audioData = Buffer.from(deepgramData.data, "base64");
        connectionState.audioManager.appendToBuffer(audioData);
        console.log(
          `[${timestamp}] 📥 Added TTS audio to buffer: ${audioData.length} bytes (total: ${connectionState.audioManager.audioBuffer.length})`
        );

        // Set a timeout to detect end of audio stream if no AgentAudioDone is received
        connectionState.audioManager.setStreamTimeout(() => {
          if (connectionState.audioManager.isStreamingAudio) {
            console.log(
              `[${timestamp}] ⏰ Audio stream timeout - assuming end of audio`
            );
            connectionState.audioManager.setStreamingState(false);
          }
        }, 1000); // 1 second timeout
      } catch (error) {
        console.error(
          `[${timestamp}] ❌ Error adding TTS audio to buffer:`,
          error
        );
      }
    } else {
      console.warn(`[${timestamp}] ⚠️ Empty or invalid audio data received`);

      // If we receive empty audio but we're supposed to be streaming,
      // this might indicate an issue with the audio stream
      if (connectionState.audioManager.isStreamingAudio) {
        console.warn(
          `[${timestamp}] 🔍 Empty audio during active stream - checking stream health`
        );

        // Set a shorter timeout for empty audio to detect stream issues faster
        connectionState.audioManager.clearStreamTimeout();
        connectionState.audioManager.setStreamTimeout(() => {
          console.log(
            `[${timestamp}] 🔄 Resetting audio stream state due to empty audio`
          );
          connectionState.audioManager.isStreamingAudio = false;
        }, 500); // Shorter timeout for empty audio
      }
    }
  } else if (deepgramData.type === "AgentAudioDone") {
    console.log(
      `[${timestamp}] 🔇 AGENT_AUDIO_DONE: AI finished sending audio`
    );

    // While the pacer handles most of this, explicitly clearing the streaming state is good practice.
    connectionState.audioManager.setStreamingState(false);

    // Clear any lingering timeout as a failsafe.
    if (connectionState.audioManager.audioStreamTimeout) {
      clearTimeout(connectionState.audioManager.audioStreamTimeout);
      connectionState.audioManager.audioStreamTimeout = null;
    }

    // Start silence tracking after AI finishes speaking using connection state
    connectionState.silenceManager.startTracking(
      timestamp,
      context,
      deepgramWs
    );

    // Set up silence detection timeouts using connection state
    const scheduleNextSilenceCheck = () => {
      connectionState.silenceManager.setSilenceTimeout(() => {
        if (!connectionState.silenceManager.silenceStartTime) return; // User started speaking or timer paused, abort

        const silenceDuration =
          connectionState.silenceManager.getSilenceDuration();
        console.log(
          `[${timestamp}] 🔇 SILENCE_CHECK: ${silenceDuration}ms of silence`
        );

        if (silenceDuration >= 15000) {
          // Auto-disconnect at 15 seconds - send InjectAgentMessage to trigger farewell and end_call
          console.log(
            `[${timestamp}] 📞 SILENCE_DISCONNECT: Auto-disconnecting after 15s silence`
          );
          deepgramWs.send(
            JSON.stringify({
              type: "InjectAgentMessage",
              content:
                "I notice you've been quiet for a while. Thank you for calling! Goodbye!",
            })
          );

          // Set a 7-second timeout to ensure call ends even if AI doesn't finish speaking
          setTimeout(() => {
            console.log(
              `[${timestamp}] ⏰ TIMEOUT: Force ending call after 7 seconds`
            );
            // Import and call endCall function directly
            import("./functionHandlers.js").then(({ endCall }) => {
              const callSid = context?.state?.callSid || context?.callSid;
              endCall(
                callSid,
                { reason: "silence timeout after 7 seconds" },
                context?.businessConfig
              );
            });
          }, 7000);

          // Clear silence tracking since we're ending the call
          connectionState.silenceManager.cleanup();
        } else if (silenceDuration < 15000) {
          // Continue checking
          scheduleNextSilenceCheck();
        }
      }, 1000); // Check every second
    };

    scheduleNextSilenceCheck();

    // The pacer will automatically switch to sending silence once the buffer is empty.
    // No need to send extra silence here; the pacer's default state handles it.
    console.log(
      `[${timestamp}] ✅ Agent speech ended. Pacer will now send silence until next utterance.`
    );
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

    // Pause silence timer while agent is thinking using connection state
    connectionState.silenceManager.pauseTimer(
      "Agent is thinking/processing",
      timestamp
    );
  } else if (deepgramData.type === "TtsStart") {
    console.log(`[${timestamp}] 🎙️ TTS_START: AI generating speech...`);
  } else if (deepgramData.type === "TtsText") {
    console.log(`[${timestamp}] 💬 TTS_TEXT: AI response:`, deepgramData.text);

    // Note: Transcript entry handled by History/ConversationText events to avoid duplicates
    // Only keeping the availability check logic here

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
    const responseText =
      deepgramData.response || deepgramData.text || "No response text";
    console.log(`[${timestamp}] 🤖 AGENT_RESPONSE:`, responseText);

    // Note: Transcript entry handled by History/ConversationText events to avoid duplicates
  } else if (deepgramData.type === "FunctionCall") {
    await handleFunctionCallMessage(deepgramData, timestamp, context);
  } else if (deepgramData.type === "FunctionCallRequest") {
    await handleFunctionCallRequestMessage(deepgramData, timestamp, context);
  } else if (deepgramData.type === "Error") {
    console.error(`[${timestamp}] ❌ DEEPGRAM_ERROR:`, deepgramData);
  } else if (deepgramData.type === "Warning") {
    console.warn(`[${timestamp}] ⚠️ DEEPGRAM_WARNING:`, deepgramData);
  } else if (deepgramData.type === "ConversationText") {
    const content = deepgramData.text || deepgramData.content;
    console.log(`[${timestamp}] 💭 CONVERSATION_TEXT:`, content);

    // Check for farewell message to trigger call ending
    // Note: ConversationText may not have role info, so we check for AI farewell patterns
    if (content && content.toLowerCase().includes("have a great day")) {
      console.log(
        `[${timestamp}] 👋 FAREWELL_DETECTED: AI said 'Have a great day' - triggering call end`
      );

      // Set 5-second timeout to end the call
      setTimeout(() => {
        console.log(
          `[${timestamp}] ⏰ FAREWELL_TIMEOUT: Ending call after 5 seconds`
        );
        import("./functionHandlers.js").then(({ endCall }) => {
          // Get the call SID from the context
          const callSid = context?.state?.callSid || context?.callSid;
          endCall(
            callSid,
            { reason: "AI farewell timeout after 5 seconds" },
            context?.businessConfig
          );
        });
      }, 5000);
    }

    // Add conversation text to transcript - both ConversationText and History are needed
    // as they may contain different messages or arrive at different times
  } else if (deepgramData.type === "FunctionResponse") {
    console.log(`[${timestamp}] 📤 FUNCTION_RESPONSE: Sent back to agent`);
    console.log(
      `[${timestamp}] 📋 Response data:`,
      JSON.stringify(deepgramData, null, 2)
    );
  } else if (deepgramData.type === "History") {
    console.log(`[${timestamp}] 📜 HISTORY: Message logged`);

    // Add message to transcript using connection state with proper role detection
    if (deepgramData.content && deepgramData.content.trim()) {
      // Deepgram sends role as 'user' or 'assistant' according to their docs
      const speaker = deepgramData.role === "user" ? "User" : "AI";
      console.log(
        `[${timestamp}] 🔍 History role: '${deepgramData.role}' -> Speaker: '${speaker}'`
      );
      connectionState.addTranscriptEntry(
        speaker,
        deepgramData.content,
        timestamp
      );
    }
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
    `[${timestamp}] 🕐 TIMING: Function call request received at ${timestamp}`
  );
  console.log(
    `[${timestamp}] 📊 FUNCTION COUNT: ${
      deepgramData.functions?.length || 0
    } functions in request`
  );
  console.log(
    `[${timestamp}] 📋 Functions:`,
    JSON.stringify(deepgramData.functions, null, 2)
  );

  // Log each function individually for better tracking
  deepgramData.functions?.forEach((func, index) => {
    console.log(`[${timestamp}] 🔍 FUNCTION ${index + 1}:`);
    console.log(`[${timestamp}]   - Name: ${func.name}`);
    console.log(`[${timestamp}]   - ID: ${func.id}`);
    console.log(`[${timestamp}]   - Arguments: ${func.arguments}`);
  });

  // Clear expectation since function call happened
  state.setExpectingFunctionCall(false);
  if (state.functionCallTimeout) {
    clearTimeout(state.functionCallTimeout);
    state.setFunctionCallTimeout(null);
  }

  // Pause silence timer during function processing using connection state
  const connectionState = context.deepgramWs.connectionState;
  connectionState.silenceManager.pauseTimer(
    "Processing function calls",
    timestamp
  );

  // Pause KeepAlive during function processing
  if (deepgramWs && deepgramWs.pauseKeepAlive) {
    deepgramWs.pauseKeepAlive();
  }

  // Process each function in the request
  for (const func of deepgramData.functions) {
    const funcTimestamp = getShortTimestamp();
    console.log(`[${funcTimestamp}] 🔧 Processing function:`, func.name);
    console.log(`[${funcTimestamp}] 🆔 Function ID:`, func.id);
    console.log(`[${funcTimestamp}] 📝 Function arguments:`, func.arguments);

    // Create the function call data in the expected format
    const functionCallData = {
      function_name: func.name,
      function_call_id: func.id,
      parameters: JSON.parse(func.arguments),
    };

    console.log(
      `[${funcTimestamp}] 📦 Created function call data:`,
      JSON.stringify(functionCallData, null, 2)
    );

    if (deepgramWs && businessConfig) {
      console.log(
        `[${funcTimestamp}] 🔧 CALLING: handleFunctionCall for ${func.name} with ID ${func.id}...`
      );
      const startTime = Date.now();
      await handleFunctionCall(
        deepgramWs,
        functionCallData,
        businessConfig,
        context.callSid,
        context.callerPhone
      );
      const endTime = Date.now();
      console.log(
        `[${funcTimestamp}] ✅ COMPLETED: handleFunctionCall for ${
          func.name
        } with ID ${func.id} (took ${endTime - startTime}ms)`
      );
    } else {
      console.error(
        `[${funcTimestamp}] ❌ CANNOT handle function call - missing dependencies`
      );
      console.log(`[${funcTimestamp}]    - deepgramWs:`, !!deepgramWs);
      console.log(`[${funcTimestamp}]    - businessConfig:`, !!businessConfig);
    }
  }

  // Resume KeepAlive after function processing
  if (deepgramWs && deepgramWs.resumeKeepAlive) {
    deepgramWs.resumeKeepAlive();
  }

  // Resume silence timer after function processing
  connectionState.silenceManager.resumeTimer(
    "Function processing completed",
    timestamp
  );
}

// Utility functions are now imported from utils.js module
