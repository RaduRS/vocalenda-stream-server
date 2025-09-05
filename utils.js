/**
 * Utility functions and constants for the Vocalenda Stream Server
 */

/**
 * Get today's date in YYYY-MM-DD format
 * @returns {string} Today's date in YYYY-MM-DD format
 */
export function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

/**
 * Generate system prompt for the AI agent
 * @param {Object} businessConfig - Business configuration object
 * @param {Object} callContext - Call context information
 * @returns {string} Generated system prompt
 */
export function generateSystemPrompt(businessConfig, callContext) {
  const business = businessConfig.business;
  const services = businessConfig.services;

  // Get today's date in YYYY-MM-DD format
  const today = getTodayDate();

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
1. AFTER getting customer name + service interest → ASK for their preferred time
2. Check if preferred time is available using get_available_slots
3. If available, confirm and book directly. If not, suggest alternatives
4. Use create_booking to confirm appointments
5. NEVER output JSON code blocks or raw JSON - ALWAYS execute/invoke functions directly
6. NEVER show JSON parameters or code - just execute the function immediately from the available functions list
7. TIME FORMAT: get_available_slots returns 12-hour format (e.g., "03:00 PM"), but create_booking requires 24-hour format (e.g., "15:00"). Always convert when booking. IMPORTANT: "03:00 PM" = "3:00 PM" = "3 PM" - these are ALL the same time!

⚡ EXACT WORKFLOW:
Customer: "I want a haircut tomorrow"
You: "Great! Your name?"
Customer: "John"
You: "Perfect John! What time would you prefer for your haircut tomorrow?"
Customer: "10am"
You: "Let me check if 10am is available for you" [IMMEDIATELY call get_available_slots for that date]
If available: "Perfect! I can book you for 10am. Shall I confirm that?"
If not: "10am isn't available, but I have 11am or 2pm. Which works better?"

🎯 BOOKING STRATEGY:
- Always ask for preferred time first
- IMMEDIATELY check availability when you say you will - never just say you'll check without actually doing it
- Only show alternatives if preferred time unavailable
- Never list all available slots unless customer asks
- Book immediately if preferred time is free

📝 BOOKING UPDATES & CANCELLATIONS:
- For security, ALWAYS require EXACT customer name and current appointment details (date & time) to update or cancel
- Use update_booking to change appointment time, date, or service
- Use cancel_booking to cancel appointments
- Never update/cancel without exact verification details🔒 SECURITY RULES:
- NEVER ask customers for their phone number - phone verification is done automatically using the caller's number

🔄 SAME-CALL OPERATIONS (CRITICAL):
- If a customer JUST made a booking in this same call and immediately wants to update/cancel it, DO NOT ask for their name, date, or time again
- The system automatically remembers their booking details from the same call session
- Simply proceed with the update/cancellation using the stored information
- Example: Customer says "Actually, can I change that to 3 PM instead?" → Just call update_booking with the new time
- Example: Customer says "Never mind, cancel that appointment" → Just call cancel_booking immediately

⚡ SESSION DATA PRIORITY:
- SAME CALL = Use stored session data automatically, no questions asked
- NEW CALL = Ask for verification details (name, date, time)
- This creates a seamless experience for immediate changes after booking

🔚 CALL ENDING:
- AFTER completing any booking, cancellation, or update, ALWAYS ask: "Is there anything else I can help you with today?"
- Only end the call when customer clearly indicates they're done ("No", "That's it", "Nothing else", "Goodbye", etc.)
- When ending, say a polite farewell like "Thank you for calling [business name]! Have a great day!" THEN use end_call function
- Don't keep talking after calling end_call

Be friendly and use functions when needed. When you say you'll check availability, IMMEDIATELY do it - don't wait for the customer to prompt you again. Never guess availability. Never mention events being added to google calendar.

🚨 CRITICAL: NEVER output JSON, code blocks, or raw parameters. When you need to use a function, execute it directly from your available functions without showing any JSON or parameters to the customer. The system will handle the function execution automatically.`;

  return prompt;
}

/**
 * Get available functions for the AI agent
 * @returns {Array} Array of function definitions
 */
export function getAvailableFunctions() {
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
      description:
        "REQUIRED: Call this function IMMEDIATELY whenever you mention checking availability or when a customer asks about booking for any date. NEVER say you'll check without actually calling this function right away. Use this to check real-time availability before discussing times.",
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
      description:
        "Create a confirmed appointment booking after customer has chosen a time",
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
            description: "Time in HH:MM format (24-hour). Convert from 12-hour format if needed (e.g., '3:00 PM' becomes '15:00')",
          },
          customer_phone: {
            type: "string",
            description: "Customer phone number (optional)",
          },
        },
        required: ["customer_name", "service_id", "date", "time"],
      },
    },
    {
      name: "update_booking",
      description:
        "Update an existing booking. SAME-CALL: If customer just made a booking in this call, you can call this with just the new details (new_date, new_time, or new_service_id) - the system will automatically use stored session data for customer_name, current_date, and current_time. NEW CALL: Requires exact customer name and current appointment details for security.",
      parameters: {
        type: "object",
        properties: {
          customer_name: {
            type: "string",
            description: "EXACT customer name (optional for same-call operations - will use session data)",
          },
          current_date: {
            type: "string",
            description: "Current appointment date in YYYY-MM-DD format (optional for same-call operations)",
          },
          current_time: {
            type: "string",
            description: "Current appointment time in HH:MM format (optional for same-call operations)",
          },
          new_date: {
            type: "string",
            description:
              "New appointment date in YYYY-MM-DD format (optional if only changing time)",
          },
          new_time: {
            type: "string",
            description:
              "New appointment time in HH:MM format (optional if only changing date)",
          },
          new_service_id: {
            type: "string",
            description: "New service ID if changing service (optional)",
          },
        },
        required: [],
      },
    },
    {
      name: "cancel_booking",
      description:
        "Cancel an existing booking. SAME-CALL: If customer just made a booking in this call, you can call this with just the reason (optional) - the system will automatically use stored session data for customer_name, date, and time. NEW CALL: Requires exact customer name and appointment details for security.",
      parameters: {
        type: "object",
        properties: {
          customer_name: {
            type: "string",
            description: "EXACT customer name (optional for same-call operations - will use session data)",
          },
          date: {
            type: "string",
            description: "Appointment date in YYYY-MM-DD format (optional for same-call operations)",
          },
          time: {
            type: "string",
            description: "Appointment time in HH:MM format (optional for same-call operations)",
          },
          reason: {
            type: "string",
            description: "Reason for cancellation (optional)",
          },
        },
        required: [],
      },
    },
    {
      name: "end_call",
      description:
        "End the phone call when the conversation has naturally concluded. Use this when the customer indicates they are finished (saying goodbye, thanking you, or expressing satisfaction with the service).",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description:
              "Brief reason for ending the call (e.g., 'appointment booked', 'customer said goodbye', 'inquiry completed')",
          },
        },
        required: ["reason"],
      },
    },
  ];
}

// Removed unused utility functions and constants
