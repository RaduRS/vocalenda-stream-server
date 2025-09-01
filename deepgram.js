import WebSocket from "ws";
import { generateSystemPrompt, getAvailableFunctions } from "./utils.js";
import { validateConfig } from "./config.js";

// Get configuration
const config = validateConfig();

/**
 * Initialize Deepgram Voice Agent connection
 * @param {Object} businessConfig - Business configuration object
 * @param {Object} callContext - Call context information
 * @param {Function} handleFunctionCall - Function to handle function calls
 * @returns {Promise<WebSocket>} - Connected Deepgram WebSocket
 */
export async function initializeDeepgram(businessConfig, callContext, handleFunctionCall) {
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

    // Create named initialization handler that can be removed specifically
    const initializationHandler = async (message) => {
      try {
        const timestamp = new Date().toISOString();

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
        console.log(
          `[${timestamp}] 📦 INIT: Full data:`,
          JSON.stringify(data, null, 2)
        );

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

          // 🚨 CRITICAL: Remove only THIS specific initialization handler
          deepgramWs.removeListener('message', initializationHandler);
          console.log(
            `[${timestamp}] 🔇 READY: Initialization handler removed, websocketHandlers will process future messages`
          );

          // Resolve the promise with the connected WebSocket
          resolve(deepgramWs);
        } else if (data.type === "FunctionCallRequest") {
          console.log(
            `[${timestamp}] 🚨 FUNCTION_CALL_REQUEST during initialization - will be handled by websocketHandlers after SettingsApplied`
          );
          // Don't process function calls during initialization
          // Let websocketHandlers.js handle all function calls after SettingsApplied
        } else {
          console.log(
            `[${timestamp}] 📨 OTHER: Initialization message type:`,
            data.type
          );
          console.log(
            `[${timestamp}] 📦 OTHER: Full data:`,
            JSON.stringify(data, null, 2)
          );
        }
      } catch (error) {
        const timestamp = new Date().toISOString();
        console.error(
          `[${timestamp}] ❌ INIT_ERROR: Processing message:`,
          error
        );
        reject(error);
      }
    };

    // Wait for Welcome message before sending configuration (like official example)
    deepgramWs.on("message", initializationHandler);

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

// Utility functions are now imported from utils.js module