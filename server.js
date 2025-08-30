import WebSocket, { WebSocketServer } from "ws";
import { createClient } from "@supabase/supabase-js";
import url from "url";
import dotenv from "dotenv";

// Load environment variables
// In production, use system environment variables
// In development, load from .env.local
if (process.env.NODE_ENV !== 'production') {
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

          // Initialize Deepgram connection
          deepgramWs = await initializeDeepgram(businessConfig, {
            businessId,
            callSid: callSid || "",
            callerPhone,
            businessPhone,
            timezone: businessConfig.business?.timezone || timezone || "UTC",
          });

          // Set up Deepgram message handling
          deepgramWs.on("message", (deepgramMessage) => {
            try {
              // Check if this is binary audio data
              if (Buffer.isBuffer(deepgramMessage)) {
                console.log("Processing binary audio data from Deepgram");
                
                // If we're receiving audio, Deepgram is clearly ready
                if (!deepgramReady) {
                  console.log("🎉 Deepgram is sending audio - marking as ready!");
                  deepgramReady = true;
                }
                
                // This is binary audio data, forward to Twilio
                const audioMessage = {
                  event: "media",
                  streamSid: data.start?.streamSid,
                  media: {
                    payload: deepgramMessage.toString('base64'),
                  },
                };
                ws.send(JSON.stringify(audioMessage));
                return;
              }
              
              // Try to parse as JSON for text messages
              const messageStr = deepgramMessage.toString();
              console.log("Message string:", messageStr);
              
              // Additional check: if it doesn't look like JSON, treat as binary
              if (!messageStr.trim().startsWith('{') && !messageStr.trim().startsWith('[')) {
                console.log("Processing non-JSON data as binary audio");
                
                // If we're receiving audio, Deepgram is clearly ready
                if (!deepgramReady) {
                  console.log("🎉 Deepgram is sending audio - marking as ready!");
                  deepgramReady = true;
                }
                
                // This is likely binary audio data, forward to Twilio
                const audioMessage = {
                  event: "media",
                  streamSid: data.start?.streamSid,
                  media: {
                    payload: deepgramMessage.toString('base64'),
                  },
                };
                ws.send(JSON.stringify(audioMessage));
                return;
              }
              
              const deepgramData = JSON.parse(messageStr);
              console.log("=== PARSED DEEPGRAM JSON ===");
              console.log(JSON.stringify(deepgramData, null, 2));

            // Handle different types of Deepgram messages
            if (deepgramData.type === "SettingsApplied") {
              // Deepgram is now ready to receive audio
              console.log("✅ Deepgram settings applied - ready to receive audio");
              deepgramReady = true;
              
              // Greeting is now handled automatically by the agent configuration
              console.log("Agent is ready with automatic greeting");
            } else if (deepgramData.type === "Welcome") {
              console.log("✅ Deepgram Welcome message received");
            } else if (deepgramData.type === "Results") {
              // Speech-to-text results
              console.log(
                "📝 Transcript:",
                deepgramData.channel?.alternatives?.[0]?.transcript
              );
            } else if (deepgramData.type === "SpeechStarted") {
              // User started speaking
              console.log("🎤 User started speaking");
            } else if (deepgramData.type === "UtteranceEnd") {
              // User finished speaking
              console.log("🔇 User finished speaking");
            } else if (deepgramData.type === "TtsAudio") {
              // AI response audio - forward to Twilio
              console.log("🔊 Received TTS audio from Deepgram");
              const audioMessage = {
                event: "media",
                streamSid: data.start?.streamSid,
                media: {
                  payload: deepgramData.data,
                },
              };
              ws.send(JSON.stringify(audioMessage));
            } else if (deepgramData.type === "FunctionCall") {
              // Handle tool calls
              console.log("🔧 Function call received:", deepgramData.function_name);
              if (deepgramWs && businessConfig) {
                handleFunctionCall(deepgramWs, deepgramData, businessConfig);
              }
            } else if (deepgramData.type === "Error") {
              console.error("❌ Deepgram Error:", deepgramData);
            } else if (deepgramData.type === "Warning") {
              console.warn("⚠️ Deepgram Warning:", deepgramData);
            } else {
              console.log("❓ Unknown Deepgram message type:", deepgramData.type);
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
          // Forward audio to Deepgram only after SettingsApplied is received
          if (deepgramWs && deepgramWs.readyState === 1 && deepgramReady) {
            // Deepgram Voice Agent expects raw binary audio data, not JSON
            const audioBuffer = Buffer.from(data.media.payload, 'base64');
            deepgramWs.send(audioBuffer);
          } else {
            console.log(`Deepgram not ready, readyState: ${deepgramWs?.readyState}, settingsApplied: ${deepgramReady}`);
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
  const deepgramWs = new WebSocket("wss://agent.deepgram.com/v1/agent/converse", {
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
    },
  });

  deepgramWs.on("open", () => {
    console.log("Connected to Deepgram Voice Agent - waiting for Welcome message");
  });

  // Wait for Welcome message before sending configuration (like official example)
  deepgramWs.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === "Welcome") {
        console.log("✅ Welcome message received - sending configuration");
        
        // Send initial configuration after Welcome (like official example)
        const systemPrompt = generateSystemPrompt(businessConfig, callContext);

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
              functions: getAvailableFunctions(),
            },
            speak: {
              provider: {
                type: "deepgram",
                model: "aura-2-thalia-en",
              },
            },
            greeting: "Thank you for calling, how can I help you today?"
          },
        };

        console.log("Sending Deepgram configuration:", JSON.stringify(config, null, 2));
        deepgramWs.send(JSON.stringify(config));
        
        // Set up keep-alive messages to maintain connection
        const keepAliveInterval = setInterval(() => {
          if (deepgramWs && deepgramWs.readyState === 1) {
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
      }
    } catch (error) {
      // This message handler is only for Welcome - other messages handled in main connection
      // Ignore parsing errors here as binary audio will fail JSON parsing
    }
  });

  deepgramWs.on("error", (error) => {
    console.error("Deepgram WebSocket error in initializeDeepgram:", error);
  });

  deepgramWs.on("close", (code, reason) => {
    console.log(`Deepgram WebSocket closed in initializeDeepgram. Code: ${code}, Reason: ${reason}`);
  });

  // Message handling is done in the main connection handler
  // to avoid duplicate handlers and conflicts

  return deepgramWs;
}

// Generate system prompt for the AI
function generateSystemPrompt(businessConfig, callContext) {
  const business = businessConfig.business;
  const services = businessConfig.services;

  let prompt = `You are a friendly and professional AI receptionist for ${business.name}.`;

  if (business.description) {
    prompt += ` ${business.description}`;
  }

  prompt += `\n\nBusiness Information:\n`;
  prompt += `- Name: ${business.name}\n`;

  if (business.address) {
    prompt += `- Address: ${business.address}\n`;
  }

  if (business.phone_number) {
    prompt += `- Phone: ${business.phone_number}\n`;
  }

  if (business.email) {
    prompt += `- Email: ${business.email}\n`;
  }

  prompt += `\nServices Available:\n`;
  services.forEach((service) => {
    prompt += `- ${service.name}: ${service.duration_minutes} minutes`;
    if (service.price) {
      prompt += `, ${service.currency}${service.price}`;
    }
    if (service.description) {
      prompt += ` - ${service.description}`;
    }
    prompt += `\n`;
  });

  prompt += `\nYour primary goal is to help customers book appointments. You can:\n`;
  prompt += `1. Provide information about services and pricing\n`;
  prompt += `2. Check availability for appointments\n`;
  prompt += `3. Book appointments for customers\n`;
  prompt += `4. Answer general questions about the business\n\n`;

  prompt += `Always be polite, helpful, and professional. If you need to book an appointment, make sure to get the customer's name, preferred service, and preferred date/time.`;

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
      description: "Get available appointment slots for a specific date",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Date in YYYY-MM-DD format",
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
      description: "Create a new appointment booking",
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
    const { function_name, parameters } = functionCallData;
    let result;

    switch (function_name) {
      case "get_services":
        result = businessConfig.services.map((s) => ({
          id: s.id,
          name: s.name,
          duration: s.duration_minutes,
          price: s.price,
          description: s.description,
        }));
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

    // Send function response back to Deepgram
    const response = {
      type: "FunctionResponse",
      function_call_id: functionCallData.function_call_id,
      result: JSON.stringify(result),
    };

    deepgramWs.send(JSON.stringify(response));
  } catch (error) {
    console.error("Error handling function call:", error);

    // Send error response
    const errorResponse = {
      type: "FunctionResponse",
      function_call_id: functionCallData.function_call_id,
      result: JSON.stringify({ error: "Function execution failed" }),
    };

    deepgramWs.send(JSON.stringify(errorResponse));
  }
}

// Get available appointment slots
async function getAvailableSlots(businessConfig, params) {
  // This is a simplified implementation
  // In a real app, you'd integrate with Google Calendar API
  const { date, service_id } = params;

  // Generate sample time slots (9 AM to 5 PM, every 30 minutes)
  const slots = [];
  for (let hour = 9; hour < 17; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const time = `${hour.toString().padStart(2, "0")}:${minute
        .toString()
        .padStart(2, "0")}`;
      slots.push({
        time,
        available: Math.random() > 0.3, // 70% chance of being available
      });
    }
  }

  return slots.filter((slot) => slot.available).map((slot) => slot.time);
}

// Create a new booking
async function createBooking(businessConfig, params) {
  try {
    const { customer_name, service_id, date, time, customer_phone } = params;

    // Find the service
    const service = businessConfig.services.find((s) => s.id === service_id);
    if (!service) {
      return { error: "Service not found" };
    }

    // Create customer if not exists
    let customer;
    if (customer_phone) {
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", customer_phone)
        .single();

      if (existingCustomer) {
        customer = existingCustomer;
      } else {
        const { data: newCustomer, error: customerError } = await supabase
          .from("customers")
          .insert({
            business_id: businessConfig.business.id,
            name: customer_name,
            phone: customer_phone,
          })
          .select("id")
          .single();

        if (customerError) {
          console.error("Error creating customer:", customerError);
          return { error: "Failed to create customer" };
        }

        customer = newCustomer;
      }
    }

    // Create the appointment
    const appointmentDateTime = `${date}T${time}:00`;

    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .insert({
        business_id: businessConfig.business.id,
        customer_id: customer?.id || null,
        service_id: service_id,
        scheduled_at: appointmentDateTime,
        duration_minutes: service.duration_minutes,
        status: "confirmed",
        customer_name: customer_name,
        customer_phone: customer_phone || null,
      })
      .select("id")
      .single();

    if (appointmentError) {
      console.error("Error creating appointment:", appointmentError);
      return { error: "Failed to create appointment" };
    }

    return {
      success: true,
      appointment_id: appointment.id,
      message: `Appointment booked for ${customer_name} on ${date} at ${time} for ${service.name}`,
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
