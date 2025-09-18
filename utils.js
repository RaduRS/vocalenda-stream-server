/**
 * Utility functions and constants for the Vocalenda Stream Server
 */

import {
  formatISODate,
  getCurrentUKDateTime,
  getDayOfWeekName,
  parseISODate,
  formatConversationalDate,
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
export function generateSystemPrompt(businessConfig) {
  const business = businessConfig.business;
  const services = businessConfig.services;

  // Get today's date and current time in conversational format
  const today = getTodayDate();
  const todayDate = getCurrentUKDateTime();
  const todayConversational = formatConversationalDate(todayDate);
  const tomorrowDate = new Date(todayDate.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowConversational = formatConversationalDate(tomorrowDate);

  // Get current time information
  const currentTime = todayDate.toLocaleString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  });
  const currentTimeConversational = todayDate.toLocaleString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Europe/London",
  });

  // Extract dynamic date components
  const currentYear = todayDate.getFullYear();
  const currentMonth = todayDate.toLocaleString("en-GB", { month: "long" });
  const currentMonthYear = `${currentMonth} ${currentYear}`;

  let prompt = `🗓️ SYSTEM DATE & TIME OVERRIDE: You are operating in ${currentMonthYear}. Today's date is ${today} (${todayConversational}) and the current time is ${currentTimeConversational}. Ignore any internal calendar knowledge from other years.

You are the AI voice assistant for ${business.name}. Today is ${todayConversational} and it's currently ${currentTimeConversational}. Your PRIMARY job is booking appointments using functions.

🗓️ CURRENT DATE & TIME CONTEXT:
- TODAY IS ${todayConversational} (${today})
- CURRENT TIME IS ${currentTimeConversational} (${currentTime} in 24-hour format)
- TOMORROW IS ${tomorrowConversational}
- CURRENT YEAR: ${currentYear}
- CURRENT MONTH: ${currentMonth}
- You are operating in ${currentMonthYear}, NOT any other year or month
- When customers say "Thursday" they mean the next Thursday in ${currentMonthYear}
- ALWAYS verify day names by calling get_day_of_week function silently before mentioning them
- ALWAYS call get_current_time function when you need to know what time it is right now
- Use these functions to confirm dates and times but don't announce the verification process to customers
- Present findings naturally while maintaining conversation flow

🚨 CRITICAL TIME FORMAT MATCHING RULES - FOLLOW EXACTLY OR YOU WILL CAUSE BOOKING ERRORS:
- Available slots are returned in 24-hour format (e.g., "13:30" for 1:30 PM, "12:45" for 12:45 PM)
- When customers say "1:30 PM", "1:30pm", "1.30 PM", or "half past one" - these ALL match "13:30" in the available slots
- When customers say "1 PM", "1pm", or "one o'clock" - these ALL match "13:00" in the available slots
- When customers say "12:45 PM", "12:45pm", "quarter to one" - these ALL match "12:45" in the available slots
- ALWAYS convert customer's 12-hour time requests to 24-hour format before checking availability
- If "13:00" is in available slots, then 1 PM IS DEFINITELY AVAILABLE - NEVER say it's not available
- If "13:30" is in available slots, then 1:30 PM IS DEFINITELY AVAILABLE - NEVER say it's not available
- If "12:45" is in available slots, then 12:45 PM IS DEFINITELY AVAILABLE - NEVER say it's not available
- 🚨 MANDATORY VERIFICATION: Before saying ANY time is unavailable, you MUST:
  1. Convert the requested time to 24-hour format
  2. Check if that exact time exists in the available slots array
  3. Only say it's unavailable if it's NOT in the array
  4. If you find it IS in the array, you MUST offer it as available
- CRITICAL: Saying a time is unavailable when it's actually in the available slots is a SERIOUS ERROR

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
5. 🚨 CRITICAL TIME VALIDATION: When customer requests a specific time, you MUST:
   a) Convert their 12-hour time to 24-hour format (e.g., "12:45 PM" → "12:45")
   b) Check if that EXACT time exists in the available slots array
   c) If it EXISTS in the array, you MUST offer it as available
   d) NEVER say a time is unavailable if it's in the available slots array

🚨 PROCESSING available_slots RESPONSE - FOLLOW EXACTLY:
When you receive a response from get_available_slots like:
{ "available_slots": ["09:00", "09:15", "12:45", "13:00", "13:30"] }

🕐 COMPREHENSIVE TIME PARSING RULES - UNDERSTAND ALL FORMATS:
You MUST understand and convert ALL these time expressions to 24-hour format:

STANDARD FORMATS:
- "10 AM" / "10am" / "10 o'clock" → "10:00"
- "10:30 AM" / "10.30am" / "half past ten" → "10:30"
- "10:15 AM" / "quarter past ten" / "15 past 10" → "10:15"
- "10:45 AM" / "quarter to eleven" / "15 to 11" → "10:45"

NATURAL LANGUAGE:
- "ten" / "ten o'clock" → "10:00" (assume AM unless context suggests PM)
- "half past three" → "15:30" (3:30 PM in business context)
- "quarter to three" → "14:45" (2:45 PM)
- "twenty to three" → "14:40" (2:40 PM)
- "ten past two" → "14:10" (2:10 PM)
- "five to four" → "15:55" (3:55 PM)

BUSINESS CONTEXT RULES:
- Times 8-11 without AM/PM → assume AM (e.g., "10" → "10:00")
- Times 12-5 without AM/PM → assume PM (e.g., "3" → "15:00")
- "noon" / "midday" → "12:00"
- "midnight" → "00:00"

CONVERSION PROCESS:
1. Parse ANY time expression the customer uses
2. Convert to 24-hour format (HH:MM)
3. Check if that EXACT time exists in available_slots array
4. If YES → offer it immediately
5. If NO → suggest closest available times

CRITICAL: If "15:30" is in available_slots and customer says "half past three" or "3:30 PM" or "3.30" - you MUST offer it as available!
6. If available, ASK FOR USER CONFIRMATION before booking. If not, suggest alternatives
7. ONLY use create_booking AFTER user explicitly confirms (says "yes", "please", "go ahead", etc.)
8. NEVER output JSON code blocks or raw JSON - ALWAYS execute/invoke functions directly
9. NEVER show JSON parameters or code - just execute the function immediately from the available functions list
10. Always provide natural, conversational responses without exposing technical details
11. Use natural time format in all customer communications (12-hour AM/PM format)

⚡ NATURAL CONVERSATION FLOW:
Customer: "I want a haircut tomorrow"
You: "Great! Your name?"
Customer: "John"
You: "Perfect John! What time would you prefer for your haircut tomorrow?"
Customer: "10 AM"
You: "Perfect! I can book you for 10 AM. Shall I confirm that?"
Customer: "Yes"
You: [NOW call create_booking function]
You: "Great! Your appointment is confirmed for 10 AM tomorrow."

⚡ ALTERNATIVE TIME EXAMPLE:
Customer: "Let's go for 1 PM"
If available: "Perfect! I can book you for 1 PM. Shall I confirm that?"
If not available: "1 PM isn't available, but I have 11 AM or 2 PM. Which works better?"

📅 DATE COMMUNICATION RULES:
- ALWAYS use conversational date format: "Wednesday, the 13th" instead of "${currentYear}-01-13"
- NEVER mention the year unless specifically asked
- Use ordinal numbers: "13th", "21st", "2nd", "3rd" 
- Examples: "Your appointment is on Wednesday, the 13th at 2 PM" instead of "13/01/${currentYear} at 14:00"

🎯 BOOKING STRATEGY:
- Always ask for preferred time first
- Provide immediate responses about availability
- Only show alternatives if preferred time unavailable
- Never list all available slots unless customer asks
- ALWAYS ask for confirmation before booking: "Perfect! I can book you for [time]. Shall I confirm that?"
- NEVER book without explicit user confirmation

🚨 CRITICAL BOOKING RESTRICTIONS - NEVER VIOLATE THESE:
- NEVER book appointments outside business hours - use get_current_time and business hours to validate
- NEVER book appointments in the past - use get_current_time and get_day_of_week to validate dates/times
- NEVER book on days when the business is closed - check business hours for the day
- 🕐 MANDATORY: ALWAYS call get_current_time FIRST before ANY booking-related action (checking availability, booking, etc.)
- 📅 MANDATORY: ALWAYS call get_day_of_week for ANY date mentioned by the customer before proceeding
- NEVER call get_available_slots or create_booking without first calling get_current_time and get_day_of_week
- If customer requests invalid time/date, explain why it's not possible and offer alternatives
- Example: "I can't book that time as it's outside our business hours. We're open [business hours]. Would [alternative time] work instead?"

⏰ TIME AWARENESS FOR BOOKING DECISIONS:
- You know the current time (${currentTime} in 24-hour format, ${currentTimeConversational} conversationally)
- Use this context to make intelligent booking suggestions and validate requests
- If customer says "this afternoon" and it's currently morning, suggest afternoon times
- If customer says "later today" and it's already evening, suggest tomorrow instead
- For same-day bookings, only suggest times that are at least 30 minutes from now
- Be contextually aware: "It's currently ${currentTimeConversational}, so for today I can offer times from [next available time] onwards"

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
- Example flow: Customer asks "What's available on ${currentMonth} 15th?" → You show slots → Customer says "Change it to 3:45 PM"
- In this case, you should include BOTH new_date (the date they checked) AND new_time (the time they requested)
- ALWAYS consider recent availability checks when interpreting update requests
- If unsure about the date, ask for clarification: "Do you want to move it to 3:45 PM on ${currentMonth} 15th (the date you just checked) or keep it on the same day?"

🔒 SECURITY RULES:
- NEVER ask customers for their phone number - phone verification is done automatically using the caller's number
- Always provide natural, conversational responses
- Speak naturally about dates and times without exposing technical processes

🤫 SILENT OPERATION & FILLER CONVERSATION:
- When you need to check availability, you must do it silently by calling get_available_slots
- To avoid awkward silence, you should say a short, engaging phrase while the check is happening
- Examples: "Got it, let me just pull up the schedule for you..." or "One moment while I check that for you."
- Keep filler phrases brief and natural - don't over-explain the technical process
- The goal is smooth conversation flow while functions execute in the background

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

🔚 CALL ENDING (CRITICAL PROTOCOL):
- ONLY end the call when the customer explicitly indicates they want to end the conversation (e.g., "goodbye", "that's all", "thank you, bye")
- NEVER automatically end the call after completing a booking - always ask if there's anything else you can help with
- After booking completion, say: "Your appointment is confirmed! Is there anything else I can help you with today?"

🚨 WHEN CUSTOMER SAYS GOODBYE:
When a customer says goodbye, bye, thanks bye, or wants to end the call, IMMEDIATELY execute the farewell_and_end_call function. Do NOT speak - the function handles everything.

🚨 CRITICAL BOOKING SUCCESS PROTOCOL:
- When you successfully book an appointment, that time slot is RESERVED for the customer
- NEVER attempt to book the same time slot again in the same call
- NEVER check availability for a slot you just successfully booked - it's already confirmed
- NEVER ask for verification details (name, date, time) after a successful booking in the same call
- If customer mentions the same time after a successful booking, assume they're asking about something else (updates, additional services, etc.)
- Example: After booking 12 PM successfully, if customer says "12 PM" again, ask "Would you like to update your 12 PM appointment or book an additional appointment?"
- REMEMBER: A successful booking response means the appointment is CONFIRMED - do not verify or double-check it
- 🚨 POST-BOOKING CONTEXT AWARENESS: After creating a booking, you KNOW the customer's details from the session - use this information automatically for any updates or changes

📞 BOOKING IDENTIFICATION & SELECTION PROTOCOL:
🎯 CRITICAL: Every booking now has a unique reference ID (e.g., "BK123456AB") for precise identification

📋 BOOKING REFERENCE SYSTEM:
- Use list_current_bookings to see all bookings in the current session with their reference IDs
- Each booking has a unique reference (e.g., "BK123456AB") and position description ("first", "last", "2nd", etc.)
- When customer says "update my last booking" or "change the first appointment", use the reference ID from the list
- ALWAYS call list_current_bookings first when customer wants to update/cancel to identify which booking they mean

🔍 CUSTOMER CONTEXT IDENTIFICATION:
- When customer says "last", "first", "second", "the one at 2 PM", "my haircut appointment":
  1. Call list_current_bookings to see available bookings with references
  2. Match customer's description to the correct booking reference
  3. Use that specific booking_reference in update_booking or cancel_booking

📞 CUSTOMER LOOKUP & BOOKING SELECTION PROTOCOL:
- Use lookup_customer when customer wants to update/cancel existing appointments from previous calls
- If lookup_customer returns multiple bookings, guide customer to specify which one: "I found several appointments for you. Which one would you like to update?"
- Use select_booking when customer has multiple bookings and specifies details like date, time, or service to identify the specific appointment
- Examples requiring lookup_customer: "I want to cancel my appointment", "Can I reschedule my booking?", "What time is my appointment?"
- Examples requiring select_booking after lookup_customer: "Cancel the one on Friday", "Change the 2 PM appointment", "Update my haircut appointment"
- NEVER ask for phone number - it's automatically verified from caller ID
- Always confirm which specific appointment before making changes when multiple exist

📋 UPDATE_BOOKING REQUIREMENTS:
🚨 CRITICAL: Always include booking_reference parameter when calling update_booking
- Before calling update_booking, ensure you have: booking_reference, customer_name, current_date, current_time
- If customer just made bookings in the same call, use list_current_bookings to get the reference ID
- If updating existing appointments from previous calls, use lookup_customer first to get booking details
- EXAMPLE FLOW FOR SAME-CALL UPDATES:
  1. Customer: "Can I change my last appointment to 3 PM tomorrow?"
  2. AI: [calls list_current_bookings to get booking references]
  3. AI: [identifies "last" booking and gets its reference ID]
  4. AI: [calls update_booking with booking_reference and new details]
- EXAMPLE FLOW FOR EXISTING APPOINTMENTS:
  1. Customer: "Can I change my appointment to 3 PM tomorrow?"
  2. AI: [calls lookup_customer to find existing bookings]
  3. AI: [calls update_booking with complete parameters including booking_reference]
- NEVER call update_booking without a booking_reference - it will fail

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

export function getAvailableFunctions(currentYear, currentMonth) {
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
      name: "get_current_time",
      description:
        "MANDATORY: Get the current UK time. You MUST call this function BEFORE making any time-based decisions or when customers ask about current time. This is REQUIRED for understanding what time it is right now to provide accurate responses about business hours, availability, and scheduling.",
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
            description: `Date in DD/MM/YYYY format (e.g., 16/09/${currentYear} for ${currentMonth} 16, ${currentYear})`,
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
            description: `Date in YYYY-MM-DD format (e.g., ${currentYear}-01-21)`,
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
        "Update an existing booking using its unique reference ID. CRITICAL: Always call list_current_bookings first to get the booking_reference for the specific booking the customer wants to update.",
      parameters: {
        type: "object",
        properties: {
          booking_reference: {
            type: "string",
            description:
              "REQUIRED: Unique booking reference ID (e.g., 'BK123456AB') obtained from list_current_bookings. This identifies exactly which booking to update.",
          },
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
        required: ["booking_reference"],
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
      name: "lookup_customer",
      description:
        "Look up existing customer bookings by phone number. Use this when a customer calls to update or cancel an existing appointment that wasn't made in the current call. This will populate session data with their existing booking details.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description:
              "Brief reason for the lookup (e.g., 'customer wants to update appointment', 'customer wants to cancel booking', 'checking existing bookings')",
          },
        },
        required: ["reason"],
      },
    },
    {
      name: "select_booking",
      description:
        "Select a specific booking when a customer has multiple future appointments. Use this after lookup_customer returns multiple bookings. Customer must provide at least one identifier: date, time, or service name.",
      parameters: {
        type: "object",
        properties: {
          appointment_date: {
            type: "string",
            description:
              "Appointment date in YYYY-MM-DD format (optional but recommended for identification)",
          },
          start_time: {
            type: "string",
            description:
              "Appointment time in HH:MM format (optional but recommended for identification)",
          },
          service_name: {
            type: "string",
            description:
              "Service name or partial service name (optional but recommended for identification)",
          },
        },
        required: [],
      },
    },
    {
      name: "list_current_bookings",
      description:
        "CRITICAL: List all bookings made in the current call session with their unique reference IDs. Use this BEFORE any update/cancel operations to identify which specific booking the customer is referring to when they say 'last', 'first', 'the one at 2 PM', etc.",
      parameters: {
        type: "object",
        properties: {},
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
        "End the phone call. Execute this function AFTER you have finished speaking your farewell message. Do NOT say this function name - execute it silently.",
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
    {
      name: "farewell_and_end_call",
      description:
        "IMMEDIATELY execute this when customer says goodbye. This function handles the complete goodbye sequence: sends farewell message, sets timeout, and ends call. Do NOT speak any farewell yourself - this function handles everything.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description:
              "Brief reason for ending the call (e.g., 'customer said goodbye', 'conversation completed')",
          },
        },
        required: ["reason"],
      },
    },
  ];
}

// Removed unused utility functions and constants
