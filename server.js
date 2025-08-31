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
              // Add comprehensive logging first
              console.log("🔍 RAW MESSAGE TYPE:", typeof deepgramMessage);
              console.log("🔍 IS BUFFER:", Buffer.isBuffer(deepgramMessage));
              console.log("🔍 MESSAGE LENGTH:", deepgramMessage.length);
              
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
                  console.log(
                    `✅ Forwarded ${deepgramMessage.length} bytes of audio to Twilio`
                  );
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
                  console.log(
                    `✅ Forwarded ${deepgramMessage.length} bytes of non-JSON audio to Twilio`
                  );
                } catch (error) {
                  console.error(
                    "❌ Error forwarding non-JSON audio to Twilio:",
                    error
                  );
                }
                return;
              }

              const deepgramData = JSON.parse(messageStr);
              
              // This is a JSON message - log it fully
              console.log("📨 JSON MESSAGE FROM DEEPGRAM:", messageStr);
              console.log("=== PARSED DEEPGRAM JSON ===");
              console.log(JSON.stringify(deepgramData, null, 2));
              console.log("=== END PARSED JSON ===");

            // Handle different types of Deepgram messages
            if (deepgramData.type === "SettingsApplied") {
                // Deepgram is now ready to receive audio
                console.log(
                  "✅ Deepgram settings applied - ready to receive audio"
                );
                console.log(
                  "Audio settings confirmed:",
                  deepgramData.audio || "No audio settings in response"
                );
                deepgramReady = true;

                // Greeting is now handled automatically by the agent configuration
                console.log("Agent is ready with automatic greeting");
              } else if (deepgramData.type === "Welcome") {
                console.log("✅ Deepgram Welcome message received");
              } else if (deepgramData.type === "Results") {
                // Speech-to-text results
                const transcript = deepgramData.channel?.alternatives?.[0]?.transcript;
                console.log("📝 Transcript:", transcript);
                
                // Enhanced detection for booking triggers
                if (transcript) {
                  const lowerTranscript = transcript.toLowerCase();
                  const bookingKeywords = ['available', 'appointment', 'book', 'schedule', 'tomorrow', 'today', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                  const namePattern = /my name is|i'm|i am|this is|call me/i;
                  
                  const hasBookingKeyword = bookingKeywords.some(keyword => lowerTranscript.includes(keyword));
                  const hasName = namePattern.test(transcript) || /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(transcript);
                  
                  if (hasBookingKeyword) {
                    console.log("🎯 BOOKING KEYWORD DETECTED:", transcript);
                    console.log("🤖 AI should call get_available_slots function soon!");
                    
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
                    console.log("👤 CUSTOMER NAME DETECTED:", transcript);
                    console.log("🚨 Next booking request should trigger function call!");
                  }
                }
              } else if (deepgramData.type === "SpeechStarted") {
                // User started speaking
                console.log("🎤 User started speaking");
              } else if (deepgramData.type === "UtteranceEnd") {
                // User finished speaking
                console.log("🔇 User finished speaking");
                console.log("🧠 AI should now be thinking and potentially making function calls...");
              } else if (deepgramData.type === "TtsAudio") {
                // AI response audio - forward to Twilio
                console.log("🔊 Received TTS audio from Deepgram - AI is responding");
                const audioMessage = {
                  event: "media",
                  streamSid: data.start?.streamSid,
                  media: {
                    payload: deepgramData.data,
                  },
                };
                ws.send(JSON.stringify(audioMessage));
              } else if (deepgramData.type === "AgentThinking") {
                console.log("🧠 AI is thinking...");
                console.log("🔍 Thinking context:", deepgramData.text || deepgramData.content || 'No thinking details provided');
                console.log("⏰ This is when function calls should happen!");
              } else if (deepgramData.type === "TtsStart") {
                console.log("🎙️ AI is generating speech...");
              } else if (deepgramData.type === "TtsText") {
                console.log("💬 AI text response:", deepgramData.text);
                // Check if AI is mentioning availability without calling function
                if (deepgramData.text && (deepgramData.text.toLowerCase().includes('available') || 
                                         deepgramData.text.toLowerCase().includes('check') ||
                                         deepgramData.text.toLowerCase().includes('let me see'))) {
                  console.log("🚨 WARNING: AI mentioned checking availability but may not have called function!");
                }
              } else if (deepgramData.type === "AgentResponse") {
                console.log("🤖 Agent response:", deepgramData.response || deepgramData.text || 'No response text');
              } else if (deepgramData.type === "FunctionCall") {
                // Handle tool calls
                console.log("🚨🚨 FUNCTION CALL DETECTED! 🚨🚨");
                console.log("✅ SUCCESS: AI is calling a function as expected!");
                console.log("Function name:", deepgramData.function_name);
                console.log("Parameters:", JSON.stringify(deepgramData.parameters, null, 2));
                console.log("🔧 Full function call data:", JSON.stringify(deepgramData, null, 2));
                
                // Clear expectation since function call happened
                expectingFunctionCall = false;
                if (functionCallTimeout) {
                  clearTimeout(functionCallTimeout);
                  functionCallTimeout = null;
                }
                
                if (deepgramWs && businessConfig) {
                  console.log("🔧 Calling handleFunctionCall...");
                  await handleFunctionCall(deepgramWs, deepgramData, businessConfig);
                  console.log("🔧 handleFunctionCall completed");
                } else {
                  console.error("❌ Cannot handle function call - missing deepgramWs or businessConfig");
                  console.log("   - deepgramWs:", !!deepgramWs);
                  console.log("   - businessConfig:", !!businessConfig);
                }
              } else if (deepgramData.type === "Error") {
                console.error("❌ Deepgram Error:", deepgramData);
              } else if (deepgramData.type === "Warning") {
                console.warn("⚠️ Deepgram Warning:", deepgramData);
              } else {
                console.log(
                  "❓ Unknown Deepgram message type:",
                  deepgramData.type
                );
                console.log("Full message:", deepgramData);
              }
            } catch (error) {
              console.error("❌ Error parsing Deepgram message:", error);
              console.error("Raw message:", deepgramMessage.toString());
            }
          });

          deepgramWs.on("error", (error) => {
            console.error("Deepgram WebSocket error:", error);
          });

          deepgramWs.on("close", () => {
            console.log("Deepgram WebSocket closed");
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
              console.log(`🎤 Forwarded ${audioBuffer.length} bytes of audio from Twilio to Deepgram`);
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
    deepgramWs.on("message", (message) => {
      try {
        // Check if this is binary data (audio) vs JSON message
        if (message instanceof Buffer && message.length > 0) {
          const messageStr = message.toString();
          // Check if it looks like JSON by examining the content
          if (!messageStr.trim().startsWith('{') && !messageStr.trim().startsWith('[')) {
            // This is binary audio data, ignore it in initialization
            return;
          }
          // Additional check for binary patterns
          if (messageStr.includes('\x00') || messageStr.includes('\xFF') || /[\x00-\x08\x0E-\x1F\x7F-\xFF]/.test(messageStr)) {
            // Contains binary characters, ignore it in initialization
            return;
          }
        }
        
        const data = JSON.parse(message.toString());

        if (data.type === "Welcome") {
          console.log("✅ Welcome message received - sending configuration");

          // Send initial configuration after Welcome (like official example)
          const systemPrompt = generateSystemPrompt(
            businessConfig,
            callContext
          );
          
          console.log("📝 Generated system prompt length:", systemPrompt.length, "characters");
          console.log("📝 System prompt preview (first 500 chars):", systemPrompt.substring(0, 500) + "...");
          console.log("🔧 FULL SYSTEM PROMPT:");
          console.log(systemPrompt);
          console.log("🔧 END SYSTEM PROMPT");
          console.log("🎯 Key function calling rules are included in prompt above");

          const functionsArray = getAvailableFunctions();
          console.log("   - Functions available:", Array.isArray(functionsArray) ? functionsArray.length : 0);

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

          console.log("📋 Deepgram configuration summary:");
          console.log("   - Audio input: mulaw, 8000Hz");
          console.log("   - Audio output: mulaw, 8000Hz");
          console.log("   - Think model: gpt-4o-mini");
          console.log("   - Speak model: aura-2-thalia-en");
          console.log("   - Functions available:", Array.isArray(functionsArray) ? functionsArray.length : 0);
          console.log("   - Prompt length:", systemPrompt?.length || 0, "characters");

          
          console.log(
            "📤 Sending Deepgram configuration:",
            JSON.stringify(config, null, 2)
          );
          
          try {
            deepgramWs.send(JSON.stringify(config));
            console.log("✅ Configuration sent successfully to Deepgram");
          } catch (configError) {
            console.error("❌ Error sending configuration to Deepgram:", configError);
            reject(configError);
            return;
          }

          // Set up keep-alive messages to maintain connection
          const keepAliveInterval = setInterval(() => {
            if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
              deepgramWs.send(JSON.stringify({ type: "KeepAlive" }));
              console.log("Sent keep-alive to Deepgram");
            } else {
              clearInterval(keepAliveInterval);
            }
          }, 5000);

          // Clean up interval when connection closes
          deepgramWs.on("close", () => {
            clearInterval(keepAliveInterval);
          });

          // Resolve the promise with the connected WebSocket
          resolve(deepgramWs);
        }
      } catch (error) {
        console.error("Error parsing Deepgram initialization message:", error);
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

  let prompt = `You are an AI receptionist for ${business.name}. Your PRIMARY job is booking appointments using functions.

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
You: "Perfect John, let me check tomorrow's availability" → CALL get_available_slots NOW

🎯 TRIGGERS (call get_available_slots immediately):
- Customer gives name + mentions: book, appointment, available, schedule, tomorrow, today, Monday, etc.
- ANY date/time reference after getting name

Be friendly but ALWAYS use functions. Never guess availability.`;

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
      deepgramWs.send(JSON.stringify(response));
      console.log("✅ Function response sent successfully to Deepgram");
      console.log("🔄 Waiting for Deepgram to process the response...");
    } catch (sendError) {
      console.error("❌ Error sending response to Deepgram:", sendError);
      throw sendError;
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
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-internal-secret': process.env.INTERNAL_API_SECRET
      }
    });

    const result = await response.json();
    console.log("📅 Calendar API response:", JSON.stringify(result, null, 2));

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
