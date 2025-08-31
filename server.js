import WebSocket, { WebSocketServer } from "ws";
import { createClient } from "@supabase/supabase-js";
import url from "url";
import dotenv from "dotenv";

// Load environment variables
// In production, use system environment variables
// In development, load from .env.local
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: ".env.local" });
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Create WebSocket server
const wss = new WebSocketServer({
  port: process.env.WS_PORT || 8080,
});

console.log(`WebSocket server running on port ${process.env.WS_PORT || 8080}`);

// Handle WebSocket connections
wss.on("connection", async (ws, req) => {
  console.log("New WebSocket connection established");

  let deepgramWs = null;
  let businessId = null;
  let callSid = null;
  let businessConfig = null;
  let deepgramReady = false; // Track if Deepgram is ready to receive audio
  let expectingFunctionCall = false;
  let functionCallTimeout = null;

  // Parse query parameters from the connection URL
  const query = url.parse(req.url, true).query;

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.event) {
        case "connected":
          console.log("Twilio connected:", data);
          break;

        case "start":
          console.log("Media stream started:", data);
          console.log("Media format:", data.start?.mediaFormat);

          // Extract parameters from Twilio
          const customParameters = data.start?.customParameters || {};
          businessId = customParameters.business_id;
          callSid = customParameters.call_sid;
          const callerPhone = customParameters.caller_phone;
          const businessPhone = customParameters.business_phone;
          const timezone = customParameters.timezone || "UTC";

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

          // Initialize Deepgram connection with proper error handling
          try {
            console.log("🔄 Initializing Deepgram connection...");
            deepgramWs = await initializeDeepgram(businessConfig, {
              businessId,
              callSid: callSid || "",
              callerPhone,
              businessPhone,
              timezone: businessConfig.business?.timezone || timezone || "UTC",
            });
            console.log("✅ Deepgram connection initialized successfully");
            console.log("Final readyState:", deepgramWs.readyState);
          } catch (error) {
            console.error("❌ Failed to initialize Deepgram:", error);
            ws.close();
            return;
          }

          // Set up Deepgram message handling
          deepgramWs.on("message", async (deepgramMessage) => {
            try {
              // Add timestamp to all logs
              const timestamp = new Date().toISOString();
              
              // Add comprehensive logging first
              console.log(`[${timestamp}] 🔍 RAW MESSAGE TYPE:`, typeof deepgramMessage);
              console.log(`[${timestamp}] 🔍 IS BUFFER:`, Buffer.isBuffer(deepgramMessage));
              console.log(`[${timestamp}] 🔍 MESSAGE LENGTH:`, deepgramMessage.length);
              
              if (!Buffer.isBuffer(deepgramMessage)) {
                console.log("🔍 NON-BUFFER MESSAGE:", deepgramMessage.toString());
              }

              // Check if this is binary audio data
              if (Buffer.isBuffer(deepgramMessage)) {
                console.log(
                  `Processing binary audio data from Deepgram (${deepgramMessage.length} bytes)`
                );

                // Validate audio data integrity
                if (deepgramMessage.length === 0) {
                  console.warn("⚠️ Received empty audio buffer from Deepgram");
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

                // This is binary audio data, forward to Twilio with validation
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
                  console.error("❌ Error forwarding audio to Twilio:", error);
                }
                return;
              }

              // Log all non-binary messages for debugging
              console.log("📨 Received Deepgram message:", deepgramMessage.toString().substring(0, 200) + "...");

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
                  console.warn(
                    "⚠️ Received empty non-JSON audio buffer from Deepgram"
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
                    "⚠️ No streamSid available for non-JSON audio forwarding"
                  );
                  return;
                }

                // This is likely binary audio data, forward to Twilio with validation
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
                    "❌ Error forwarding non-JSON audio to Twilio:",
                    error
                  );
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
            if (deepgramData.type === "SettingsApplied") {
                // Deepgram is now ready to receive audio
                console.log(`[${timestamp}] ✅ SETTINGS_APPLIED: Deepgram ready to receive audio`);
                 console.log(`[${timestamp}] 🔧 Audio settings:`, deepgramData.audio || "No audio settings");
                 console.log(`[${timestamp}] 🤖 Agent config:`, deepgramData.agent || "No agent config");
                 deepgramReady = true;
                 console.log(`[${timestamp}] 🎙️ Agent ready with automatic greeting`);
              } else if (deepgramData.type === "Welcome") {
                console.log(`[${timestamp}] ✅ WELCOME: Deepgram connection established`);
              } else if (deepgramData.type === "Results") {
                // Speech-to-text results
                const transcript = deepgramData.channel?.alternatives?.[0]?.transcript;
                console.log(`[${timestamp}] 📝 RESULTS: Transcript:`, transcript);
                console.log(`[${timestamp}] 🔍 Full Results:`, JSON.stringify(deepgramData, null, 2));
                
                // Enhanced detection for booking triggers
                if (transcript) {
                  const lowerTranscript = transcript.toLowerCase();
                  const bookingKeywords = ['available', 'appointment', 'book', 'schedule', 'tomorrow', 'today', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                  const namePattern = /my name is|i'm|i am|this is|call me/i;
                  
                  const hasBookingKeyword = bookingKeywords.some(keyword => lowerTranscript.includes(keyword));
                  const hasName = namePattern.test(transcript) || /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(transcript);
                  
                  if (hasBookingKeyword) {
                    console.log(`[${timestamp}] 🎯 BOOKING_KEYWORD_DETECTED:`, transcript);
                    console.log(`[${timestamp}] 🤖 EXPECTING: get_available_slots function call soon!`);
                    
                    // Set expectation for function call
                    expectingFunctionCall = true;
                    
                    // Clear any existing timeout
                    if (functionCallTimeout) {
                      clearTimeout(functionCallTimeout);
                    }
                    
                    // Set timeout to detect if function call doesn't happen
                    functionCallTimeout = setTimeout(() => {
                      if (expectingFunctionCall) {
                        console.log("🚨🚨 CRITICAL: AI FAILED TO CALL FUNCTION! 🚨🚨");
                        console.log("💡 Expected get_available_slots but AI responded with text instead");
                        console.log("🔧 This indicates the system prompt needs adjustment");
                        expectingFunctionCall = false;
                      }
                    }, 8000); // 8 second timeout
                  }
                  
                  if (hasName) {
                    console.log(`[${timestamp}] 👤 CUSTOMER_NAME_DETECTED:`, transcript);
                    console.log(`[${timestamp}] 🚨 NEXT: Booking request should trigger function call!`);
                  }
                }
              } else if (deepgramData.type === "SpeechStarted") {
                console.log(`[${timestamp}] 🎤 SPEECH_STARTED: User began speaking`);
              } else if (deepgramData.type === "UtteranceEnd") {
                console.log(`[${timestamp}] 🔇 UTTERANCE_END: User finished speaking`);
                console.log(`[${timestamp}] 🧠 EXPECTING: AgentThinking → FunctionCall or TtsStart`);
              } else if (deepgramData.type === "TtsAudio") {
                console.log(`[${timestamp}] 🔊 TTS_AUDIO: AI sending audio response (${deepgramData.data?.length || 0} chars)`);
                const audioMessage = {
                  event: "media",
                  streamSid: data.start?.streamSid,
                  media: {
                    payload: deepgramData.data,
                  },
                };
                ws.send(JSON.stringify(audioMessage));
              } else if (deepgramData.type === "AgentThinking") {
                console.log(`[${timestamp}] 🧠 AGENT_THINKING: AI processing...`);
                console.log(`[${timestamp}] 🔍 Thinking details:`, deepgramData.text || deepgramData.content || deepgramData.thinking || 'No thinking details');
                console.log(`[${timestamp}] ⏰ CRITICAL: Function calls should happen during thinking!`);
              } else if (deepgramData.type === "TtsStart") {
                console.log(`[${timestamp}] 🎙️ TTS_START: AI generating speech...`);
              } else if (deepgramData.type === "TtsText") {
                console.log(`[${timestamp}] 💬 TTS_TEXT: AI response:`, deepgramData.text);
                // Check if AI is mentioning availability without calling function
                if (deepgramData.text && (deepgramData.text.toLowerCase().includes('available') || 
                                         deepgramData.text.toLowerCase().includes('check') ||
                                         deepgramData.text.toLowerCase().includes('let me see'))) {
                  console.log(`[${timestamp}] 🚨 WARNING: AI mentioned availability but NO FUNCTION CALL detected!`);
                }
              } else if (deepgramData.type === "AgentResponse") {
                console.log(`[${timestamp}] 🤖 AGENT_RESPONSE:`, deepgramData.response || deepgramData.text || 'No response text');
              } else if (deepgramData.type === "FunctionCall") {
                console.log(`[${timestamp}] 🚨🚨 FUNCTION_CALL DETECTED! 🚨🚨`);
                console.log(`[${timestamp}] ✅ SUCCESS: AI calling function as expected!`);
                console.log(`[${timestamp}] 🔧 Function:`, deepgramData.function_name);
                console.log(`[${timestamp}] 📋 Parameters:`, JSON.stringify(deepgramData.parameters, null, 2));
                console.log(`[${timestamp}] 📦 Full payload:`, JSON.stringify(deepgramData, null, 2));
                
                // Clear expectation since function call happened
                expectingFunctionCall = false;
                if (functionCallTimeout) {
                  clearTimeout(functionCallTimeout);
                  functionCallTimeout = null;
                }
                
                if (deepgramWs && businessConfig) {
                  console.log(`[${timestamp}] 🔧 CALLING: handleFunctionCall...`);
                  await handleFunctionCall(deepgramWs, deepgramData, businessConfig);
                  console.log(`[${timestamp}] ✅ COMPLETED: handleFunctionCall`);
                } else {
                  console.error(`[${timestamp}] ❌ CANNOT handle function call - missing dependencies`);
                  console.log(`[${timestamp}]    - deepgramWs:`, !!deepgramWs);
                  console.log(`[${timestamp}]    - businessConfig:`, !!businessConfig);
                }
              } else if (deepgramData.type === "FunctionCallRequest") {
                console.log(`[${timestamp}] 🚨🚨 FUNCTION_CALL_REQUEST DETECTED! 🚨🚨`);
                console.log(`[${timestamp}] ✅ SUCCESS: AI requesting function calls!`);
                console.log(`[${timestamp}] 📋 Functions:`, JSON.stringify(deepgramData.functions, null, 2));
                
                // Clear expectation since function call happened
                expectingFunctionCall = false;
                if (functionCallTimeout) {
                  clearTimeout(functionCallTimeout);
                  functionCallTimeout = null;
                }
                
                // Process each function in the request
                for (const func of deepgramData.functions) {
                  console.log(`[${timestamp}] 🔧 Processing function:`, func.name);
                  
                  // Create the function call data in the expected format
                  const functionCallData = {
                    function_name: func.name,
                    function_call_id: func.id,
                    parameters: JSON.parse(func.arguments)
                  };
                  
                  if (deepgramWs && businessConfig) {
                    console.log(`[${timestamp}] 🔧 CALLING: handleFunctionCall for ${func.name}...`);
                    await handleFunctionCall(deepgramWs, functionCallData, businessConfig);
                    console.log(`[${timestamp}] ✅ COMPLETED: handleFunctionCall for ${func.name}`);
                  } else {
                    console.error(`[${timestamp}] ❌ CANNOT handle function call - missing dependencies`);
                    console.log(`[${timestamp}]    - deepgramWs:`, !!deepgramWs);
                    console.log(`[${timestamp}]    - businessConfig:`, !!businessConfig);
                  }
                }
              } else if (deepgramData.type === "Error") {
                console.error(`[${timestamp}] ❌ DEEPGRAM_ERROR:`, deepgramData);
              } else if (deepgramData.type === "Warning") {
                console.warn(`[${timestamp}] ⚠️ DEEPGRAM_WARNING:`, deepgramData);
              } else if (deepgramData.type === "ConversationText") {
                console.log(`[${timestamp}] 💭 CONVERSATION_TEXT:`, deepgramData.text || deepgramData.content);
              } else if (deepgramData.type === "FunctionResponse") {
                console.log(`[${timestamp}] 📤 FUNCTION_RESPONSE: Sent back to agent`);
                console.log(`[${timestamp}] 📋 Response data:`, JSON.stringify(deepgramData, null, 2));
              } else {
                console.log(`[${timestamp}] ❓ UNKNOWN_EVENT_TYPE: ${deepgramData.type}`);
                console.log(`[${timestamp}] 📦 Full message:`, JSON.stringify(deepgramData, null, 2));
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
            console.log(`Deepgram WebSocket closed. Code: ${code}, Reason: ${reason}`);
            // Only close Twilio connection if it's an unexpected close
            if (code !== 1000 && code !== 1001) {
              console.error("🚨 Unexpected Deepgram close - this may cause issues");
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
              `⚠️ Cannot forward audio - deepgramWs ready: ${!!deepgramWs && deepgramWs.readyState === WebSocket.OPEN}, isReady: ${deepgramReady}`
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
});

// Load business configuration from Supabase
async function loadBusinessConfig(businessId) {
  try {
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .single();

    if (businessError || !business) {
      console.error("Failed to load business:", businessError);
      return null;
    }

    const { data: config, error: configError } = await supabase
      .from("business_config")
      .select("*")
      .eq("business_id", businessId)
      .single();

    const { data: services, error: servicesError } = await supabase
      .from("services")
      .select("*")
      .eq("business_id", businessId)
      .eq("is_active", true);

    // Log Google Calendar connection status for debugging
    console.log(`📅 Business ${business.name} Google Calendar Status:`);
    console.log(
      `   - Calendar ID: ${business.google_calendar_id || "Not connected"}`
    );
    console.log(`   - Timezone: ${business.timezone || "Not set"}`);
    console.log(
      `   - Integration Config: ${
        config?.integration_settings?.google ? "Available" : "Not available"
      }`
    );

    return {
      business,
      config: config || null,
      services: services || [],
    };
  } catch (error) {
    console.error("Error loading business config:", error);
    return null;
  }
}

// Initialize Deepgram Voice Agent connection
async function initializeDeepgram(businessConfig, callContext) {
  return new Promise((resolve, reject) => {
    const deepgramWs = new WebSocket(
      "wss://agent.deepgram.com/v1/agent/converse",
      ["token", process.env.DEEPGRAM_API_KEY]
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
        
        // Check if this is binary data (audio) vs JSON message
        if (message instanceof Buffer && message.length > 0) {
          const messageStr = message.toString();
          // Check if it looks like JSON by examining the content
          if (!messageStr.trim().startsWith('{') && !messageStr.trim().startsWith('[')) {
            // This is binary audio data, not a JSON message
            console.log(`[${timestamp}] 🔊 INIT: Received binary audio from Deepgram (${message.length} bytes)`);
            return;
          }
          // Additional check for binary patterns
          if (messageStr.includes('\x00') || messageStr.includes('\xFF') || /[\x00-\x08\x0E-\x1F\x7F-\xFF]/.test(messageStr)) {
            // Contains binary characters, ignore it in initialization
            console.log(`[${timestamp}] 🔊 INIT: Ignoring binary data in initialization`);
            return;
          }
        }
        
        const data = JSON.parse(message.toString());
        console.log(`[${timestamp}] 📨 INIT: Deepgram message:`, data.type);
        console.log(`[${timestamp}] 📦 INIT: Full data:`, JSON.stringify(data, null, 2));

        if (data.type === "Welcome") {
          console.log(`[${timestamp}] ✅ WELCOME: Received - sending agent configuration...`);

          // Generate system prompt
          const systemPrompt = generateSystemPrompt(
            businessConfig,
            callContext
          );
          
          console.log(`[${timestamp}] 📝 PROMPT: Generated length:`, systemPrompt.length, "characters");
          console.log(`[${timestamp}] 📝 PROMPT: Preview (first 500 chars):`, systemPrompt.substring(0, 500) + "...");
          console.log(`[${timestamp}] 🔧 PROMPT: Full content:`);
          console.log(systemPrompt);
          console.log(`[${timestamp}] 🔧 PROMPT: End of content`);
          console.log(`[${timestamp}] 🎯 PROMPT: Function calling rules included:`, systemPrompt.includes("get_available_slots"));

          const functionsArray = getAvailableFunctions();
          console.log(`[${timestamp}] 🔧 FUNCTIONS: Available count:`, Array.isArray(functionsArray) ? functionsArray.length : 0);

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
          console.log(`[${timestamp}]    - Functions available:`, Array.isArray(functionsArray) ? functionsArray.length : 0);
          console.log(`[${timestamp}]    - Prompt length:`, systemPrompt?.length || 0, "characters");

          // Validate config before sending
          if (!config.agent.think.prompt) {
            console.error(`[${timestamp}] ❌ CONFIG: Missing system prompt!`);
            reject(new Error("Missing system prompt"));
            return;
          }
          
          if (!config.agent.think.functions || config.agent.think.functions.length === 0) {
            console.error(`[${timestamp}] ❌ CONFIG: Missing functions!`);
            reject(new Error("Missing function definitions"));
            return;
          }
          
          console.log(`[${timestamp}] 📤 SENDING: Configuration to Deepgram...`);
          console.log(`[${timestamp}] 📦 CONFIG: Full payload:`, JSON.stringify(config, null, 2));
          
          try {
            deepgramWs.send(JSON.stringify(config));
            console.log(`[${timestamp}] ✅ SENT: Configuration sent successfully to Deepgram`);
            console.log(`[${timestamp}] ⏳ WAITING: For SettingsApplied confirmation...`);
          } catch (configError) {
            console.error(`[${timestamp}] ❌ ERROR: Sending configuration to Deepgram:`, configError);
            reject(configError);
            return;
          }

          // Set up keep-alive messages to maintain connection
          const keepAliveInterval = setInterval(() => {
            if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
              deepgramWs.send(JSON.stringify({ type: "KeepAlive" }));
              console.log(`[${new Date().toISOString()}] 💓 KEEPALIVE: Sent to Deepgram`);
            } else {
              clearInterval(keepAliveInterval);
            }
          }, 5000);

          // Clean up interval when connection closes
          deepgramWs.on("close", () => {
            clearInterval(keepAliveInterval);
          });
        } else if (data.type === "SettingsApplied") {
          console.log(`[${timestamp}] ✅ SETTINGS_APPLIED: Agent configuration confirmed!`);
          console.log(`[${timestamp}] 🎯 READY: Agent can now handle conversations and function calls`);
          console.log(`[${timestamp}] 🔧 APPLIED: Audio settings:`, data.audio || "No audio config");
          console.log(`[${timestamp}] 🔧 APPLIED: Agent settings:`, data.agent || "No agent config");
          
          // Resolve the promise with the connected WebSocket
          resolve(deepgramWs);
        } else if (data.type === "FunctionCallRequest") {
          console.log(`[${timestamp}] 🚨🚨 FUNCTION_CALL_REQUEST in INIT! 🚨🚨`);
          console.log(`[${timestamp}] ✅ SUCCESS: AI requesting function calls!`);
          console.log(`[${timestamp}] 📋 Functions:`, JSON.stringify(data.functions, null, 2));
          
          // Process each function in the request
          for (const func of data.functions) {
            console.log(`[${timestamp}] 🔧 Processing function:`, func.name);
            
            // Create the function call data in the expected format
            const functionCallData = {
              function_name: func.name,
              function_call_id: func.id,
              parameters: JSON.parse(func.arguments)
            };
            
            console.log(`[${timestamp}] 🔧 CALLING: handleFunctionCall for ${func.name}...`);
            await handleFunctionCall(deepgramWs, functionCallData, businessConfig);
            console.log(`[${timestamp}] ✅ COMPLETED: handleFunctionCall for ${func.name}`);
          }
        } else {
          console.log(`[${timestamp}] 📨 OTHER: Initialization message type:`, data.type);
          console.log(`[${timestamp}] 📦 OTHER: Full data:`, JSON.stringify(data, null, 2));
        }
      } catch (error) {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] ❌ INIT_ERROR: Processing message:`, error);
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

// Generate system prompt for the AI
function generateSystemPrompt(businessConfig, callContext) {
  const business = businessConfig.business;
  const services = businessConfig.services;
  
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  let prompt = `You are an AI receptionist for ${business.name}. Today is ${today} (YYYY-MM-DD format). Your PRIMARY job is booking appointments using functions.

BUSINESS: ${business.name}`;
  if (business.address) prompt += ` | ${business.address}`;
  if (business.phone_number) prompt += ` | ${business.phone_number}`;

  prompt += `\n\nSERVICES:`;
  services.forEach((service) => {
    prompt += ` ${service.name}(${service.duration_minutes}min)`;
    if (service.price) prompt += `£${service.price}`;
    prompt += `,`;
  });

  prompt += `\n\n🚨 MANDATORY FUNCTION RULES:
1. AFTER getting customer name + service interest → IMMEDIATELY call get_available_slots
2. NEVER discuss times without calling get_available_slots first
3. Use create_booking to confirm appointments

⚡ EXACT WORKFLOW:
Customer: "I want a haircut tomorrow"
You: "Great! Your name?"
Customer: "John"
You: "Perfect John, let me check tomorrow's availability" → [call get_available_slots function]

🎯 TRIGGERS (call get_available_slots immediately):
- Customer gives name + mentions: book, appointment, available, schedule, tomorrow, today, Monday, etc.
- ANY date/time reference after getting name

Be friendly but ALWAYS use functions silently. Never announce function calls. Never guess availability.`;

  return prompt;
}

// Get available functions for the AI
function getAvailableFunctions() {
  return [
    {
      name: "get_services",
      description: "Get list of available services",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "get_available_slots",
      description: "REQUIRED: Call this function whenever a customer asks about availability, booking, or appointments for any date. Use this to check real-time availability before discussing times.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Date in YYYY-MM-DD format (e.g., 2025-01-21)",
          },
          service_id: {
            type: "string",
            description: "Optional service ID to filter slots",
          },
        },
        required: ["date"],
      },
    },
    {
      name: "create_booking",
      description: "Create a confirmed appointment booking after customer has chosen a time",
      parameters: {
        type: "object",
        properties: {
          customer_name: {
            type: "string",
            description: "Customer full name",
          },
          service_id: {
            type: "string",
            description: "ID of the service to book",
          },
          date: {
            type: "string",
            description: "Date in YYYY-MM-DD format",
          },
          time: {
            type: "string",
            description: "Time in HH:MM format (24-hour)",
          },
          customer_phone: {
            type: "string",
            description: "Customer phone number (optional)",
          },
        },
        required: ["customer_name", "service_id", "date", "time"],
      },
    },
  ];
}

// Handle function calls from the AI agent
async function handleFunctionCall(
  deepgramWs,
  functionCallData,
  businessConfig
) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🚀 STARTING handleFunctionCall`);
  console.log(`[${timestamp}] 🔧 Function call received:`, JSON.stringify(functionCallData, null, 2));
  console.log(`[${timestamp}] 📋 Function name:`, functionCallData?.function_name);
  console.log(`[${timestamp}] 📊 Parameters:`, JSON.stringify(functionCallData?.parameters, null, 2));
  console.log(`[${timestamp}] 🏢 Business config exists:`, !!businessConfig);
  console.log(`[${timestamp}] 🌐 WebSocket state:`, deepgramWs?.readyState);
  
  try {
    console.log(
      "🔧 Function call received:",
      JSON.stringify(functionCallData, null, 2)
    );
    const { function_name, parameters } = functionCallData;
    let result;

    switch (function_name) {
      case "get_services":
        console.log("🔍 Processing get_services request...");
        console.log("📊 Raw services from config:", businessConfig.services.length, "services found");
        
        result = businessConfig.services.map((s) => ({
          id: s.id,
          name: s.name,
          duration: s.duration_minutes,
          price: s.price,
          description: s.description,
        }));
        
        console.log("📋 Mapped services result:", JSON.stringify(result, null, 2));
        console.log("✅ get_services processing complete");
        break;

      case "get_available_slots":
        result = await getAvailableSlots(businessConfig, parameters);
        break;

      case "create_booking":
        result = await createBooking(businessConfig, parameters);
        break;

      default:
        result = { error: "Unknown function" };
    }

    // Send response back to Deepgram
    const response = {
      type: "FunctionResponse",
      function_call_id: functionCallData.function_call_id,
      result: JSON.stringify(result),
    };
    
    console.log("🔧 About to send function response:");
    console.log("   - Function:", function_name);
    console.log("   - Result type:", typeof result);
    console.log("   - Result content:", JSON.stringify(result, null, 2));
    console.log("   - Stringified result:", JSON.stringify(result));

    console.log("📤 Sending function response to Deepgram:", JSON.stringify(response, null, 2));
    
    try {
      if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
        deepgramWs.send(JSON.stringify(response));
        console.log("✅ Function response sent successfully to Deepgram");
        console.log("🔄 Waiting for Deepgram to process the response...");
      } else {
        console.error("❌ Cannot send function response - Deepgram connection not open");
        console.error("   - WebSocket exists:", !!deepgramWs);
        console.error("   - ReadyState:", deepgramWs?.readyState);
        throw new Error("Deepgram connection not available");
      }
    } catch (sendError) {
      console.error("❌ Error sending response to Deepgram:", sendError);
      // Don't throw the error to prevent connection closure
      console.error("🔧 Continuing despite send error to maintain connection");
    }
  } catch (error) {
    console.error("Error handling function call:", error);

    // Send error response
    const errorResponse = {
      type: "FunctionResponse",
      function_call_id: functionCallData.function_call_id,
      result: { error: "Function execution failed" },
    };

    deepgramWs.send(JSON.stringify(errorResponse));
  }
}

// Get available appointment slots
async function getAvailableSlots(businessConfig, params) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🚀 STARTING getAvailableSlots with params:`, JSON.stringify(params, null, 2));
  console.log(`[${timestamp}] 🏢 Business config:`, businessConfig?.business?.name);
  console.log(`[${timestamp}] 📋 Services count:`, businessConfig?.services?.length);
  console.log(`[${timestamp}] 🌐 Site URL:`, process.env.NEXT_PUBLIC_SITE_URL);
  console.log(`[${timestamp}] 🔑 Secret exists:`, !!process.env.INTERNAL_API_SECRET);
  
  try {
    console.log("🗓️ Getting available slots for:", JSON.stringify(params, null, 2));
    const { date, service_id } = params;
    const business = businessConfig.business;
    
    if (!business?.google_calendar_id) {
      console.error("❌ No Google Calendar connected for business");
      return { error: 'Calendar not connected' };
    }

    // Get service details and duration
    let serviceId = service_id;
    let service = null;
    
    if (serviceId) {
      service = businessConfig.services.find(s => s.id === serviceId);
      if (service) {
        console.log("📋 Using service:", service.name, "(Duration:", service.duration_minutes, "minutes)");
      } else {
        console.error("❌ Service not found with ID:", serviceId);
        return { error: `Service not found: ${serviceId}` };
      }
    } else if (businessConfig.services.length > 0) {
      // Use first available service as default
      service = businessConfig.services[0];
      serviceId = service.id;
      console.log("📋 Using default service:", service.name, "(Duration:", service.duration_minutes, "minutes)");
    } else {
      console.error("❌ No services available");
      return { error: "No services available" };
    }

    // Call calendar slots API to check availability (NOT for booking)
    // The /api/internal/booking endpoint is used for actual booking creation
    const apiUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/calendar/slots?businessId=${business.id}&serviceId=${serviceId}&date=${date}`;
    
    console.log(`[${timestamp}] 🌐 About to make API call:`);
    console.log(`[${timestamp}] 🔗 API URL:`, apiUrl);
    console.log(`[${timestamp}] 🔑 Secret exists:`, !!process.env.INTERNAL_API_SECRET);
    console.log(`[${timestamp}] 🏢 Business ID:`, business.id);
    console.log(`[${timestamp}] 📋 Service ID:`, serviceId);
    console.log(`[${timestamp}] 📅 Date:`, date);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-internal-secret': process.env.INTERNAL_API_SECRET
      }
    });
    
    console.log(`[${timestamp}] 📡 API Response status:`, response.status);
    console.log(`[${timestamp}] 📡 API Response ok:`, response.ok);

    const result = await response.json();
    console.log(`[${timestamp}] 📅 Calendar API response:`, JSON.stringify(result, null, 2));
    console.log(`[${timestamp}] 📊 Response type:`, typeof result);
    console.log(`[${timestamp}] 📊 Has slots:`, !!result.slots);
    console.log(`[${timestamp}] 📊 Slots count:`, result.slots?.length || 0);

    if (!response.ok) {
      console.error("❌ Calendar API error:", result);
      return { error: result.error || "Failed to get available slots" };
    }

    // Extract just the time strings from the slots
    const availableTimes = result.slots?.map(slot => slot.startTime) || [];
    console.log("✅ Available time slots:", availableTimes);
    
    return {
      available_slots: availableTimes
    };
  } catch (error) {
    console.error("❌ Error getting available slots:", error);
    return { error: "Failed to get available slots" };
  }
}

// Create a new booking by calling the internal Next.js API endpoint
async function createBooking(businessConfig, params) {
  try {
    console.log(
      "🎯 createBooking called with params:",
      JSON.stringify(params, null, 2)
    );
    console.log("📋 Available services:", businessConfig.services.map(s => ({ id: s.id, name: s.name })));
    
    const { customer_name, service_id, date, time, customer_phone } = params;

    // Validate required parameters
    if (!customer_name || !service_id || !date || !time) {
      console.error("❌ Missing required booking parameters:", { customer_name, service_id, date, time });
      return { error: "Missing required information: name, service, date, and time are required" };
    }

    // Find the service (try by ID first, then by name as fallback)
    let service = businessConfig.services.find((s) => s.id === service_id);
    if (!service) {
      // Try to find by name (case-insensitive)
      service = businessConfig.services.find((s) => 
        s.name.toLowerCase() === service_id.toLowerCase()
      );
    }
    if (!service) {
      console.error("❌ Service not found. Service ID/Name:", service_id);
      console.error("📋 Available services:", businessConfig.services.map(s => `${s.id}: ${s.name}`));
      return { error: `Service not found. Available services: ${businessConfig.services.map(s => s.name).join(', ')}` };
    }
    console.log("✅ Service found:", service.name, "(ID:", service.id, ")");

    // Calculate start and end times
    const appointmentDateTime = `${date}T${time}:00`;
    const startTime = new Date(appointmentDateTime);
    const endTime = new Date(
      startTime.getTime() + service.duration_minutes * 60000
    );

    // Prepare booking data for the Next.js API
    const bookingData = {
      businessId: businessConfig.business.id,
      serviceId: service_id,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      customerName: customer_name,
      customerPhone: customer_phone || null,
      customerEmail: null, // Voice calls don't typically capture email
      notes: `Voice booking - Customer: ${customer_name}`,
    };

    console.log("📞 Calling internal Next.js booking API...");
    console.log("🔗 API URL:", `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/internal/booking`);
    console.log("📦 Booking data:", JSON.stringify(bookingData, null, 2));

    // Call the internal Next.js booking API endpoint
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/internal/booking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": process.env.INTERNAL_API_SECRET,
      },
      body: JSON.stringify(bookingData),
    });

    console.log("📡 API Response status:", response.status, response.statusText);
    
    const result = await response.json();
    console.log("📋 API Response body:", JSON.stringify(result, null, 2));

    if (!response.ok) {
      console.error("❌ Booking API error:", result);
      return { error: result.error || "Failed to create booking" };
    }

    console.log(
      "✅ Appointment created successfully via API:",
      result.appointmentId
    );
    console.log("📅 Calendar event ID:", result.calendarEventId || "None");

    const successMessage = `Appointment booked for ${customer_name} on ${date} at ${time} for ${service.name}`;
    const calendarNote = result.calendarEventId
      ? " Event has been added to your Google Calendar."
      : "";

    return {
      success: true,
      appointment_id: result.appointmentId,
      calendar_event_id: result.calendarEventId,
      message: successMessage + calendarNote,
    };
  } catch (error) {
    console.error("Error in createBooking:", error);
    return { error: "Booking failed" };
  }
}

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("Shutting down WebSocket server...");
  wss.close(() => {
    console.log("WebSocket server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("Shutting down WebSocket server...");
  wss.close(() => {
    console.log("WebSocket server closed");
    process.exit(0);
  });
});
