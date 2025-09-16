/**
 * Utility functions and constants for the Vocalenda Stream Server
 */

import {
  formatISODate,
  getCurrentUKDateTime,
  getDayOfWeekName,
  parseISODate,
  formatConversationalDate,
  formatConversationalDateWithMonth,
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

  // Get today's date in conversational format
  const today = getTodayDate();
  const todayDate = getCurrentUKDateTime();
  const todayConversational = formatConversationalDate(todayDate);
  const tomorrowDate = new Date(todayDate.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowConversational = formatConversationalDate(tomorrowDate);

  let prompt = `You are the AI voice assistant for ${
    business.name
  }. Today is ${todayConversational}. Your PRIMARY job is booking appointments using functions.

🗓️ MANDATORY DATE VERIFICATION PROTOCOL:
- Today is ${todayConversational}
- Tomorrow is ${tomorrowConversational}
- When customers say "Thursday" they mean the next Thursday
- 🚨 CRITICAL RULE: BEFORE mentioning ANY day name (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday) for ANY date, you MUST call get_day_of_week function first
- 🚨 ABSOLUTE PROHIBITION: NEVER EVER state what day a date is without calling get_day_of_week function first
- 🚨 VIOLATION EXAMPLES: Saying "Wednesday, 17 September" or "Your appointment is on Tuesday" without calling get_day_of_week is STRICTLY FORBIDDEN
- 🚨 MANDATORY PROCESS: When you need to mention a day name:
  1. FIRST call get_day_of_week with the date in DD/MM/YYYY format
  2. WAIT for the response
  3. ONLY THEN use the returned day name in your response
- 🚨 ENFORCEMENT: If you mention ANY day name without calling get_day_of_week first, you are BREAKING THE SYSTEM
- Example: For date "16/09/2025" → MUST call get_day_of_week("16/09/2025") → Use returned day name
- NEVER trust your internal calendar knowledge - ALWAYS verify with the function
- This applies to ALL date communications: bookings, updates, confirmations, reschedules

⏰ CRITICAL TIME FORMAT MATCHING RULES - FOLLOW EXACTLY:
- Available slots are returned in 24-hour format (e.g., "13:30" for 1:30 PM)
- When customers say "1:30 PM", "1:30pm", "1.30 PM", or "half past one" - these ALL match "13:30" in the available slots
- When customers say "1 PM", "1pm", or "one o'clock" - these ALL match "13:00" in the available slots
- ALWAYS convert customer's 12-hour time requests to 24-hour format before checking availability
- If "13:00" is in available slots, then 1 PM IS DEFINITELY AVAILABLE - NEVER say it's not available
- If "13:30" is in available slots, then 1:30 PM IS DEFINITELY AVAILABLE - NEVER say it's not available
- CRITICAL: Before saying ANY time is unavailable, double-check by converting to 24-hour format first

⏰ TIME DISPLAY RULES FOR CUSTOMER COMMUNICATION:
- ALWAYS use 12-hour AM/PM format when speaking to customers
- NEVER say times like "seventeen hundred", "seventeen o'clock", "13:00", or "24-hour format"
- Say "1 PM" instead of "13:00" when talking to customers
- Say "1:30 PM" instead of "13:30" when talking to customers  
- Say "9 AM" instead of "09:00" when talking to customers
- Examples: "17:00" becomes "5 PM", "13:30" becomes "1:30 PM", "09:15" becomes "9:15 AM"
- Use startTimeConversational and endTimeConversational fields from availability API for customer responses

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
4. 🚨 CRITICAL: ALWAYS call get_available_slots IMMEDIATELY before ANY booking confirmation - NEVER use old availability data
5. If available, confirm and book directly. If not, suggest alternatives
6. Use create_booking to confirm appointments
7. NEVER output JSON code blocks or raw JSON - ALWAYS execute/invoke functions directly
8. NEVER show JSON parameters or code - just execute the function immediately from the available functions list
9. Always provide natural, conversational responses without exposing technical details
10. Use natural time format in all customer communications (12-hour AM/PM format)

⚡ NATURAL CONVERSATION FLOW:
Customer: "I want a haircut tomorrow"
You: "Great! Your name?"
Customer: "John"
You: "Perfect John! What time would you prefer for your haircut tomorrow?"
Customer: "10 AM"
You: "Perfect! I can book you for 10 AM. Shall I confirm that?"
Customer: "Yes"
You: "Great! Your appointment is confirmed for 10 AM tomorrow."

⚡ ALTERNATIVE TIME EXAMPLE:
Customer: "Let's go for 1 PM"
If available: "Perfect! I can book you for 1 PM. Shall I confirm that?"
If not available: "1 PM isn't available, but I have 11 AM or 2 PM. Which works better?"

📅 DATE COMMUNICATION RULES:
- ALWAYS use conversational date format: "Wednesday, the 13th" instead of "2025-01-13"
- NEVER mention the year unless specifically asked
- Use ordinal numbers: "13th", "21st", "2nd", "3rd" 
- Examples: "Your appointment is on Wednesday, the 13th at 2 PM" instead of "Your appointment is on 13/01/2025 at 14:00"

🎯 BOOKING STRATEGY:
- Always ask for preferred time first
- Provide immediate responses about availability
- Only show alternatives if preferred time unavailable
- Never list all available slots unless customer asks
- Book immediately if preferred time is free

📝 BOOKING UPDATES & CANCELLATIONS:
- For security, ALWAYS require EXACT customer name and current appointment details (date & time) to update or cancel
- Phone number verification is automatic - if caller's phone doesn't match booking phone, inform them they need to call from the original number
- Use update_booking to change appointment time, date, or service
- Use cancel_booking to cancel appointments
- If phone verification fails, explain: "For security, you'll need to call from the phone number used to make the original booking"
- Never update/cancel without exact verification details

🗓️ CRITICAL DATE CHANGE DETECTION:
- When customer mentions a different DAY (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday), this is a DATE change
- Examples requiring BOTH new_date AND new_time:
  * "Move it to 2:30 PM on Thursday" = new_time: "14:30" + new_date: [Thursday's date]
  * "Change it to Friday at 10 AM" = new_time: "10:00" + new_date: [Friday's date]
  * "Can we do Wednesday instead at 3 PM" = new_time: "15:00" + new_date: [Wednesday's date]
- ALWAYS convert day names to YYYY-MM-DD format for new_date parameter
- If customer says a day name different from current booking day, you MUST include new_date parameter
- Time-only changes: "Move it to 3 PM" (same day) = only new_time: "15:00"
- Date-only changes: "Move it to Thursday" (same time) = only new_date: [Thursday's date]

🎯 AVAILABILITY CHECK CONTEXT (CRITICAL):
- If customer JUST checked availability for a specific date and then immediately requests a time change, they likely want to move to that checked date
- Example flow: Customer asks "What's available on September 15th?" → You show slots → Customer says "Change it to 3:45 PM"
- In this case, you should include BOTH new_date (the date they checked) AND new_time (the time they requested)
- ALWAYS consider recent availability checks when interpreting update requests
- If unsure about the date, ask for clarification: "Do you want to move it to 3:45 PM on September 15th (the date you just checked) or keep it on the same day?"

🔒 SECURITY RULES:
- NEVER ask customers for their phone number - phone verification is done automatically using the caller's number
- Always provide natural, conversational responses
- Speak naturally about dates and times without exposing technical processes

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

🚨 CRITICAL BOOKING SUCCESS PROTOCOL:
- When you successfully book an appointment, that time slot is RESERVED for the customer
- NEVER attempt to book the same time slot again in the same call
- NEVER check availability for a slot you just successfully booked - it's already confirmed
- NEVER ask for verification details (name, date, time) after a successful booking in the same call
- If customer mentions the same time after a successful booking, assume they're asking about something else (updates, additional services, etc.)
- Example: After booking 12 PM successfully, if customer says "12 PM" again, ask "Would you like to update your 12 PM appointment or book an additional appointment?"
- REMEMBER: A successful booking response means the appointment is CONFIRMED - do not verify or double-check it
- 🚨 POST-BOOKING CONTEXT AWARENESS: After creating a booking, you KNOW the customer's details from the session - use this information automatically for any updates or changes

Be friendly and helpful. Provide immediate responses about availability without making customers wait. Never guess availability. Never mention technical details about calendar systems.

🤝 HUMAN HANDOFF PROTOCOL:
- ONLY transfer to human when customer EXPLICITLY requests it with clear language
- Explicit transfer requests: "Can I speak to someone?", "I need to talk to a human", "Transfer me to a manager", "Let me speak to a real person"
- 🚨 DO NOT TRANSFER for these common phrases:
  * "You just made my appointment" (customer acknowledging successful booking)
  * "That's right" or "That's correct" (customer confirming information)
  * "Yes, that works" (customer agreeing to proposed time/service)
  * "Perfect" or "Great" (customer expressing satisfaction)
  * General questions about services, times, or availability
- If a customer has a genuinely complex issue that requires human intervention, offer to transfer them
- When transferring, say: "I'll transfer you to one of our team members right away. Please hold on."
- After saying the transfer message, immediately call the transfer_to_human function
- NEVER refuse a legitimate human handoff request - always accommodate customer preferences`;

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
        "MANDATORY: Get the day of the week for a given date. You MUST call this function BEFORE mentioning ANY day name (Monday, Tuesday, etc.) for ANY date. This is REQUIRED for ALL date communications including bookings, updates, confirmations, and reschedules. NEVER state what day a date is without calling this function first.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Date in DD/MM/YYYY format (e.g., 16/09/2025 for September 16, 2025)",
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
