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
            const deepgramData = JSON.parse(deepgramMessage.toString());

            // Handle different types of Deepgram messages
            if (deepgramData.type === "Results") {
              // Speech-to-text results
              console.log(
                "Transcript:",
                deepgramData.channel?.alternatives?.[0]?.transcript
              );
            } else if (deepgramData.type === "SpeechStarted") {
              // User started speaking
              console.log("User started speaking");
            } else if (deepgramData.type === "UtteranceEnd") {
              // User finished speaking
              console.log("User finished speaking");
            } else if (deepgramData.type === "TtsAudio") {
              // AI response audio - forward to Twilio
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
              if (deepgramWs && businessConfig) {
                handleFunctionCall(deepgramWs, deepgramData, businessConfig);
              }
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
          // Forward audio to Deepgram
          if (deepgramWs && deepgramWs.readyState === 1) {
            // Deepgram Voice Agent expects raw binary audio data, not JSON
            const audioBuffer = Buffer.from(data.media.payload, 'base64');
            console.log(`Forwarding audio chunk: ${audioBuffer.length} bytes`);
            deepgramWs.send(audioBuffer);
          } else {
            console.log(`Deepgram not ready, readyState: ${deepgramWs?.readyState}`);
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
    console.log("Connected to Deepgram Voice Agent");

    // Send initial configuration
    const systemPrompt = generateSystemPrompt(businessConfig, callContext);

    const config = {
      type: "SettingsConfiguration",
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
        listen: {
          model: "nova-3",
        },
        think: {
          provider: {
            type: "open_ai_llm",
            model: "gpt-4o-mini",
          },
          instructions: systemPrompt,
          functions: getAvailableFunctions(),
        },
        speak: {
          model: "aura-thalia-en",
        },
      },
    };

    console.log("Sending Deepgram configuration:", JSON.stringify(config, null, 2));
    deepgramWs.send(JSON.stringify(config));
  });

  deepgramWs.on("error", (error) => {
    console.error("Deepgram WebSocket error in initializeDeepgram:", error);
  });

  deepgramWs.on("close", (code, reason) => {
    console.log(`Deepgram WebSocket closed in initializeDeepgram. Code: ${code}, Reason: ${reason}`);
  });

  deepgramWs.on("message", (message) => {
    console.log("Deepgram message received:", message.toString());
  });

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
