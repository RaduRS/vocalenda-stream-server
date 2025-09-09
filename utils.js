/**
 * Utility functions and constants for the Vocalenda Stream Server
 */

import {
  formatISODate,
  getCurrentUKDateTime,
  getDayOfWeekName,
  parseISODate,
} from "./dateUtils.js";

/**
 * Get today's date in YYYY-MM-DD format
 * @returns {string} Today's date in YYYY-MM-DD format
 */
export function getTodayDate() {
  return formatISODate(getCurrentUKDateTime());
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
  const todayDate = getCurrentUKDateTime();
  const todayDayName = todayDate.toLocaleDateString("en-GB", {
    weekday: "long",
  });

  let prompt = `You are an AI receptionist for ${
    business.name
  }. Today is ${today} (${todayDayName}). Your PRIMARY job is booking appointments using functions.

🗓️ MANDATORY DATE VERIFICATION PROTOCOL:
- Today is ${todayDayName}, ${today}
- When customers say "Thursday" they mean the next Thursday
- When customers say "tomorrow" they mean ${
    new Date(todayDate.getTime() + 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0]
  }
- 🚨 ABSOLUTE RULE: BEFORE mentioning ANY day name for ANY date, you MUST call get_day_of_week function first
- 🚨 FORBIDDEN: NEVER state what day a date is without calling get_day_of_week function
- 🚨 MANDATORY: If you mention "September 11th is Wednesday" without calling get_day_of_week, you are VIOLATING the protocol
- 🚨 REQUIRED PROCESS: Date mentioned → IMMEDIATELY call get_day_of_week → Use the returned day name
- Example: Customer says "September 11th" → You MUST call get_day_of_week("11/09/2025") → Use the result to say the correct day
- NEVER trust your internal knowledge about dates - ALWAYS verify with the function

⏰ TIME FORMAT MATCHING RULES:
- Available slots are returned in 24-hour format (e.g., "13:30" for 1:30 PM)
- When customers say "1:30 PM", "1:30pm", "1.30 PM", or "half past one" - these ALL match "13:30" in the available slots
- When customers say "1 PM", "1pm", or "one o'clock" - these ALL match "13:00" in the available slots
- ALWAYS convert customer's 12-hour time requests to 24-hour format before checking availability
- If "13:30" is in available slots, then 1:30 PM IS available - never say it's not available

⏰ TIME DISPLAY RULES:
- NEVER say times like "seventeen hundred" or "seventeen o'clock" - always use 12-hour format when speaking
- Say "5 PM" instead of "17:00" when talking to customers
- Convert 24-hour format to natural 12-hour format for customer communication
- Example: "17:00" becomes "5 PM", "13:30" becomes "1:30 PM"

BUSINESS: ${business.name}`;
  if (business.address) prompt += ` | ${business.address}`;
  if (business.phone_number) prompt += ` | ${business.phone_number}`;

  prompt += `\n\nSERVICES:`;
  services.forEach((service) => {
    prompt += ` ${service.name}(${service.duration_minutes}min)`;
    if (service.price) prompt += `£${service.price}`;
    prompt += `,`;
  });

  // Add staff information if available
  const staffMembers = businessConfig.staffMembers || [];
  if (staffMembers.length > 0) {
    prompt += `\n\nSTAFF MEMBERS:`;
    staffMembers.forEach((staff) => {
      prompt += ` ${staff.name}`;
      if (staff.specialties && staff.specialties.length > 0) {
        prompt += ` (${staff.specialties.join(", ")})`;
      }
      prompt += `,`;
    });
    prompt += `\n\n📋 STAFF BOOKING NOTES:\n- Customers can request specific staff members by name\n- If no preference is mentioned, any available staff member can provide the service\n- NEVER ask about staff preferences unless customer specifically mentions wanting a particular staff member\n- Only discuss staff options if customer asks about specific staff members`;
  }

  // Add business hours information if available
  const businessHours = businessConfig.config?.business_hours;
  if (businessHours) {
    prompt += `\n\n🕐 BUSINESS HOURS:`;
    if (businessHours.monday)
      prompt += ` Mon: ${businessHours.monday.open}-${businessHours.monday.close}`;
    if (businessHours.tuesday)
      prompt += ` Tue: ${businessHours.tuesday.open}-${businessHours.tuesday.close}`;
    if (businessHours.wednesday)
      prompt += ` Wed: ${businessHours.wednesday.open}-${businessHours.wednesday.close}`;
    if (businessHours.thursday)
      prompt += ` Thu: ${businessHours.thursday.open}-${businessHours.thursday.close}`;
    if (businessHours.friday)
      prompt += ` Fri: ${businessHours.friday.open}-${businessHours.friday.close}`;
    if (businessHours.saturday)
      prompt += ` Sat: ${businessHours.saturday.open}-${businessHours.saturday.close}`;
    if (businessHours.sunday)
      prompt += ` Sun: ${businessHours.sunday.open}-${businessHours.sunday.close}`;
    prompt += `\n\n⚠️ BUSINESS HOURS VALIDATION:\n- NEVER check availability for times outside business hours\n- If customer requests booking outside business hours, politely inform them of operating hours\n- Only call get_available_slots for times within business hours`;
  }

  prompt += `\n\n🚨 MANDATORY FUNCTION RULES:
1. AFTER getting customer name + service interest → ASK for their preferred time
2. VALIDATE requested time is within business hours BEFORE checking availability
3. Check if preferred time is available using get_available_slots (only if within business hours)
4. If available, confirm and book directly. If not, suggest alternatives
5. Use create_booking to confirm appointments
6. NEVER output JSON code blocks or raw JSON - ALWAYS execute/invoke functions directly
7. NEVER show JSON parameters or code - just execute the function immediately from the available functions list
8. NEVER announce that you are calling a function or checking something - just do it silently and respond with the results
9. TIME FORMAT: get_available_slots returns 24-hour format (e.g., "15:00"), and create_booking also requires 24-hour format (e.g., "15:00"). When customers say "3:00 PM" or "3 PM", convert to "15:00" to match available slots. IMPORTANT: "03:00 PM" = "3:00 PM" = "3 PM" = "15:00" - these are ALL the same time!

⚡ EXACT WORKFLOW:
Customer: "I want a haircut tomorrow"
You: "Great! Your name?"
Customer: "John"
You: "Perfect John! What time would you prefer for your haircut tomorrow?"
Customer: "10am"
[SILENTLY call get_available_slots - DO NOT say "let me check"]
If available: "Perfect! I can book you for 10am. Shall I confirm that?"
If not: "10am isn't available, but I have 11am or 2pm. Which works better?"

🎯 BOOKING STRATEGY:
- Always ask for preferred time first
- SILENTLY check availability - never announce you're checking
- Only show alternatives if preferred time unavailable
- Never list all available slots unless customer asks
- Book immediately if preferred time is free

📝 BOOKING UPDATES & CANCELLATIONS:
- For security, ALWAYS require EXACT customer name and current appointment details (date & time) to update or cancel
- Phone number verification is automatic - if caller's phone doesn't match booking phone, inform them they need to call from the original number
- Use update_booking to change appointment time, date, or service
- Use cancel_booking to cancel appointments
- If phone verification fails, explain: "For security, you'll need to call from the phone number used to make the original booking"
- Never update/cancel without exact verification details🔒 SECURITY RULES:
- NEVER ask customers for their phone number - phone verification is done automatically using the caller's number
- NEVER announce function calls or mention JSON parameters to customers
- NEVER say things like "Let me check availability" or "I'm calling the booking function"
- Execute all functions silently in the background
- Use get_day_of_week function silently to verify dates without announcing - just say the correct day naturally in conversation

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
- ONLY end the call when the customer explicitly indicates they want to end the conversation (e.g., "goodbye", "that's all", "thank you, bye")
- NEVER automatically end the call after completing a booking - always ask if there's anything else you can help with
- After booking completion, say: "Your appointment is confirmed! Is there anything else I can help you with today?"
- To end the call, you MUST first say a polite, concluding farewell phrase
- Your absolute final action in the conversation MUST be to call/run/trigger the end_call function for ending the call
- Example Farewell Sequence:
  - Customer says: "That's all, thank you!"
  - You say: "Thank you for calling [business name], have a great day!"
  - You immediately run/trigger: end_call function without actually saying it

Be friendly and use functions when needed. When you say you'll check availability, IMMEDIATELY do it - don't wait for the customer to prompt you again. Never guess availability. Never mention events being added to google calendar.

🚨 CRITICAL: NEVER output JSON, code blocks, or raw parameters. When you need to use a function, execute it directly from your available functions without showing any JSON or parameters to the customer. The system will handle the function execution automatically.

🤝 HUMAN HANDOFF PROTOCOL:
- If a customer requests to speak to a human, manager, or real person, use the transfer_to_human function
- If a customer has a complex issue that requires human intervention, offer to transfer them
- Common transfer triggers: "Can I speak to someone?", "I need to talk to a human", "Transfer me to a manager", "This is too complicated"
- When transferring, say: "I'll transfer you to one of our team members right away. Please hold on."
- After saying the transfer message, immediately call the transfer_to_human function
- NEVER refuse a human handoff request - always accommodate customer preferences`;

  return prompt;
}

/**
 * Get available functions for the AI agent
 * @returns {Array} Array of function definitions
 */
/**
 * Check if a requested time is within business hours
 * @param {Object} businessConfig - Business configuration object
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} time - Time in HH:MM format (24-hour)
 * @returns {Object} { isWithinHours: boolean, message?: string }
 */
export function isWithinBusinessHours(date, time, businessConfig) {
  const businessHours = businessConfig.config?.business_hours;

  if (!businessHours) {
    // If no business hours configured, allow all times
    return { isWithin: true };
  }

  try {
    // Parse the date using UK date utilities to get day of week
    const parsedDate = typeof date === "string" ? parseISODate(date) : date;
    const dayName = getDayOfWeekName(parsedDate).toLowerCase();

    const dayHours = businessHours[dayName];

    if (!dayHours || !dayHours.open || !dayHours.close) {
      return {
        isWithin: false,
        message: `We're closed on ${
          dayName.charAt(0).toUpperCase() + dayName.slice(1)
        }s`,
      };
    }

    // Convert times to minutes for comparison
    const [requestHour, requestMin] = time.split(":").map(Number);
    const requestMinutes = requestHour * 60 + requestMin;

    const [openHour, openMin] = dayHours.open.split(":").map(Number);
    const openMinutes = openHour * 60 + openMin;

    const [closeHour, closeMin] = dayHours.close.split(":").map(Number);
    const closeMinutes = closeHour * 60 + closeMin;

    if (requestMinutes < openMinutes || requestMinutes >= closeMinutes) {
      return {
        isWithin: false,
        message: `We're open ${dayHours.open}-${dayHours.close} on ${
          dayName.charAt(0).toUpperCase() + dayName.slice(1)
        }s`,
      };
    }

    return { isWithin: true };
  } catch (error) {
    console.error("Error checking business hours:", error);
    return { isWithin: true }; // Default to allowing if error
  }
}

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
      name: "get_staff_members",
      description:
        "Get list of available staff members who can provide services",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "get_day_of_week",
      description:
        "Get the day of the week for a given date. Use this to verify dates silently in the background without announcing to the customer.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Date in DD/MM/YYYY format (e.g., 11/09/2025)",
          },
        },
        required: ["date"],
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
            description:
              "Time in HH:MM format (24-hour). Convert from 12-hour format if needed (e.g., '3:00 PM' becomes '15:00')",
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
            description:
              "EXACT customer name (optional for same-call operations - will use session data)",
          },
          current_date: {
            type: "string",
            description:
              "Current appointment date in YYYY-MM-DD format (optional for same-call operations)",
          },
          current_time: {
            type: "string",
            description:
              "Current appointment time in HH:MM format (optional for same-call operations)",
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
            description:
              "EXACT customer name (optional for same-call operations - will use session data)",
          },
          date: {
            type: "string",
            description:
              "Appointment date in YYYY-MM-DD format (optional for same-call operations)",
          },
          time: {
            type: "string",
            description:
              "Appointment time in HH:MM format (optional for same-call operations)",
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
      name: "transfer_to_human",
      description:
        "Transfer the customer to a human team member when they request to speak to someone or need human assistance",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description:
              "Brief reason for the transfer (e.g., 'customer requested human', 'complex issue', 'manager requested')",
          },
        },
        required: ["reason"],
      },
    },
    {
      name: "end_call",
      description:
        "Say the farewell and then end the phone call. This function MUST be the absolute last action in the conversation after you said the farewell phrase. ",
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
