import WebSocket from "ws";
import { getConfig } from "./config.js";

const config = getConfig();

/**
 * Main function call handler that routes function calls to appropriate handlers
 * @param {WebSocket} deepgramWs - The Deepgram WebSocket connection
 * @param {Object} functionCallData - The function call data from Deepgram
 * @param {Object} businessConfig - The business configuration
 */
export async function handleFunctionCall(
  deepgramWs,
  functionCallData,
  businessConfig,
  callSid = null
) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🚀 STARTING handleFunctionCall`);
  console.log(
    `[${timestamp}] 🔧 Function call received:`,
    JSON.stringify(functionCallData, null, 2)
  );
  console.log(
    `[${timestamp}] 📋 Function name:`,
    functionCallData?.function_name
  );
  console.log(
    `[${timestamp}] 📊 Parameters:`,
    JSON.stringify(functionCallData?.parameters, null, 2)
  );
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
        console.log(
          "📊 Raw services from config:",
          businessConfig.services.length,
          "services found"
        );

        result = businessConfig.services.map((s) => ({
          id: s.id,
          name: s.name,
          duration: s.duration_minutes,
          price: s.price,
          description: s.description,
        }));

        console.log(
          "📋 Mapped services result:",
          JSON.stringify(result, null, 2)
        );
        console.log("✅ get_services processing complete");
        break;

      case "get_available_slots":
        result = await getAvailableSlots(businessConfig, parameters);
        break;

      case "create_booking":
        result = await createBooking(businessConfig, parameters);
        break;

      case "update_booking":
        result = await updateBooking(businessConfig, parameters);
        break;

      case "cancel_booking":
        result = await cancelBooking(businessConfig, parameters);
        break;

      case "end_call":
        result = await endCall(callSid, parameters);
        break;

      default:
        result = { error: "Unknown function" };
    }

    // Send response back to Deepgram
    const response = {
      type: "FunctionCallResponse",
      id: functionCallData.function_call_id,
      name: function_name,
      content: JSON.stringify(result), // Deepgram expects content as string
    };

    console.log(`✅ Sending ${function_name} response to Deepgram`);
    // Reduced logging for better performance

    try {
      if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
        deepgramWs.send(JSON.stringify(response));
        console.log("✅ Function response sent successfully to Deepgram");
        console.log("🔄 Waiting for Deepgram to process the response...");

        // Add a small delay to ensure Deepgram processes the response before any KeepAlive
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        console.error(
          "❌ Cannot send function response - Deepgram connection not open"
        );
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
      type: "FunctionCallResponse",
      id: functionCallData.function_call_id,
      name: function_name,
      content: JSON.stringify({ error: "Function execution failed" }),
    };

    deepgramWs.send(JSON.stringify(errorResponse));
  }
}

/**
 * Get available appointment slots for a given date and service
 * @param {Object} businessConfig - The business configuration
 * @param {Object} params - Parameters including date and service_id
 * @returns {Object} Available slots or error
 */
export async function getAvailableSlots(businessConfig, params) {
  const timestamp = new Date().toISOString();
  console.log(
    `[${timestamp}] 🚀 STARTING getAvailableSlots with params:`,
    JSON.stringify(params, null, 2)
  );
  console.log(
    `[${timestamp}] 🏢 Business config:`,
    businessConfig?.business?.name
  );
  console.log(
    `[${timestamp}] 📋 Services count:`,
    businessConfig?.services?.length
  );
  console.log(
    `[${timestamp}] 🌐 Site URL:`,
    config.nextjs?.siteUrl || "Not configured"
  );
  console.log(
    `[${timestamp}] 🔑 Secret exists:`,
    !!config.nextjs?.internalApiSecret
  );

  try {
    console.log(
      "🗓️ Getting available slots for:",
      JSON.stringify(params, null, 2)
    );
    const { date, service_id } = params;
    const business = businessConfig.business;

    if (!business?.google_calendar_id) {
      console.error("❌ No Google Calendar connected for business");
      return { error: "Calendar not connected" };
    }

    // Get service details and duration
    let serviceId = service_id;
    let service = null;

    if (serviceId) {
      // First try to find by ID (UUID)
      service = businessConfig.services.find((s) => s.id === serviceId);

      // If not found by ID, try to find by name (case-insensitive)
      if (!service) {
        service = businessConfig.services.find(
          (s) => s.name.toLowerCase() === serviceId.toLowerCase()
        );
        if (service) {
          serviceId = service.id; // Use the actual UUID
          console.log(
            `📋 Found service by name '${service_id}' -> ID: ${serviceId}`
          );
        }
      }

      if (service) {
        console.log(
          "📋 Using service:",
          service.name,
          "(Duration:",
          service.duration_minutes,
          "minutes)"
        );
      } else {
        console.error("❌ Service not found with ID/Name:", serviceId);
        console.error(
          "📋 Available services:",
          businessConfig.services.map((s) => `${s.name} (${s.id})`)
        );
        return {
          error: `Service not found: ${serviceId}. Available services: ${businessConfig.services
            .map((s) => s.name)
            .join(", ")}`,
        };
      }
    } else if (businessConfig.services.length > 0) {
      // Use first available service as default
      service = businessConfig.services[0];
      serviceId = service.id;
      console.log(
        "📋 Using default service:",
        service.name,
        "(Duration:",
        service.duration_minutes,
        "minutes)"
      );
    } else {
      console.error("❌ No services available");
      return { error: "No services available" };
    }

    // Call calendar slots API to check availability (NOT for booking)
    // The /api/internal/booking endpoint is used for actual booking creation
    const apiUrl = `${config.nextjs.siteUrl}/api/calendar/slots?businessId=${business.id}&serviceId=${serviceId}&date=${date}`;

    console.log(`[${timestamp}] 🌐 About to make API call:`);
    console.log(`[${timestamp}] 🔗 API URL:`, apiUrl);
    console.log(
      `[${timestamp}] 🔑 Secret exists:`,
      !!config.nextjs?.internalApiSecret
    );
    console.log(`[${timestamp}] 🏢 Business ID:`, business.id);
    console.log(`[${timestamp}] 📋 Service ID:`, serviceId);
    console.log(`[${timestamp}] 📅 Date:`, date);

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "x-internal-secret": config.nextjs.internalApiSecret,
      },
    });

    console.log(`[${timestamp}] 📡 API Response status:`, response.status);
    console.log(`[${timestamp}] 📡 API Response ok:`, response.ok);

    const result = await response.json();
    console.log(
      `[${timestamp}] 📅 Calendar API response:`,
      JSON.stringify(result, null, 2)
    );
    console.log(`[${timestamp}] 📊 Response type:`, typeof result);
    console.log(`[${timestamp}] 📊 Has slots:`, !!result.slots);
    console.log(`[${timestamp}] 📊 Slots count:`, result.slots?.length || 0);

    if (!response.ok) {
      console.error("❌ Calendar API error:", result);
      return { error: result.error || "Failed to get available slots" };
    }

    // Extract just the time strings from the slots
    const availableTimes = result.slots?.map((slot) => slot.startTime) || [];
    console.log("✅ Available time slots:", availableTimes);

    return {
      available_slots: availableTimes,
    };
  } catch (error) {
    console.error("❌ Error getting available slots:", error);
    return { error: "Failed to get available slots" };
  }
}

/**
 * Create a new booking by calling the internal Next.js API endpoint
 * @param {Object} businessConfig - The business configuration
 * @param {Object} params - Booking parameters including customer info, service, date, time
 * @returns {Object} Booking result or error
 */
export async function createBooking(businessConfig, params) {
  try {
    console.log(
      "🎯 createBooking called with params:",
      JSON.stringify(params, null, 2)
    );
    console.log(
      "📋 Available services:",
      businessConfig.services.map((s) => ({ id: s.id, name: s.name }))
    );

    const { customer_name, service_id, date, time, customer_phone } = params;

    // Validate required parameters
    if (!customer_name || !service_id || !date || !time) {
      console.error("❌ Missing required booking parameters:", {
        customer_name,
        service_id,
        date,
        time,
      });
      return {
        error:
          "Missing required information: name, service, date, and time are required",
      };
    }

    // Find the service (try by ID first, then by name as fallback)
    let service = businessConfig.services.find((s) => s.id === service_id);
    if (!service) {
      // Try to find by name (case-insensitive)
      service = businessConfig.services.find(
        (s) => s.name.toLowerCase() === service_id.toLowerCase()
      );
      if (service) {
        console.log(
          `📋 Booking - Found service by name '${service_id}' -> ID: ${service.id}`
        );
      }
    }
    if (!service) {
      console.error("❌ Service not found. Service ID/Name:", service_id);
      console.error(
        "📋 Available services:",
        businessConfig.services.map((s) => `${s.id}: ${s.name}`)
      );
      return {
        error: `Service not found. Available services: ${businessConfig.services
          .map((s) => s.name)
          .join(", ")}`,
      };
    }
    console.log(
      "✅ Booking - Service found:",
      service.name,
      "(ID:",
      service.id,
      ")"
    );

    // Calculate start and end times with proper timezone handling
    const business = businessConfig.business;
    const businessTimezone = business.timezone || "UTC";

    console.log(
      `🕐 Creating appointment for ${date} at ${time} in timezone: ${businessTimezone}`
    );

    // Create datetime in the business timezone (no conversion needed)
    const appointmentDateTime = `${date}T${time}:00`;

    // Parse the date/time as local business time
    // The internal API will handle timezone properly for calendar events
    const startTime = new Date(appointmentDateTime);
    const endTime = new Date(
      startTime.getTime() + service.duration_minutes * 60000
    );

    console.log(
      `🕐 Appointment datetime (business local): ${appointmentDateTime}`
    );
    console.log(`🕐 Business timezone: ${businessTimezone}`);
    console.log(`🕐 Start time: ${startTime.toISOString()}`);
    console.log(`🕐 End time: ${endTime.toISOString()}`);

    // Prepare booking data for the Next.js API
    const bookingData = {
      businessId: businessConfig.business.id,
      serviceId: service.id, // Use the actual service UUID, not the name
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      customerName: customer_name,
      customerPhone: customer_phone || null,
      customerEmail: null, // Voice calls don't typically capture email
      notes: `Voice booking - Customer: ${customer_name}`,
    };

    console.log("📞 Calling internal Next.js booking API...");
    console.log(
      "🔗 API URL:",
      `${config.nextjs.siteUrl || "http://localhost:3000"}/api/internal/booking`
    );
    console.log("📦 Booking data:", JSON.stringify(bookingData, null, 2));

    // Call the internal Next.js booking API endpoint
    const baseUrl = config.nextjs.siteUrl || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/internal/booking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": config.nextjs.internalApiSecret,
      },
      body: JSON.stringify(bookingData),
    });

    console.log(
      "📡 API Response status:",
      response.status,
      response.statusText
    );

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

/**
 * Update an existing booking
 * @param {Object} businessConfig - The business configuration
 * @param {Object} params - Parameters including customer details and new booking info
 * @returns {Object} Update result or error
 */
export async function updateBooking(businessConfig, params) {
  try {
    console.log(
      "📝 updateBooking called with params:",
      JSON.stringify(params, null, 2)
    );

    const {
      customer_name,
      current_date,
      current_time,
      new_date,
      new_time,
      new_service_id,
    } = params;

    const business = businessConfig.business;

    if (!business?.google_calendar_id) {
      console.error("❌ No Google Calendar connected for business");
      return { error: "Calendar not connected" };
    }

    // Call the internal Next.js API to update the booking
    const response = await fetch(
      `${config.nextjs.siteUrl}/api/voice/update-booking`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": config.nextjs.internalApiSecret,
        },
        body: JSON.stringify({
          business_id: business.id,
          customer_name,
          current_date,
          current_time,
          new_date,
          new_time,
          new_service_id,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Update booking API error:", response.status, errorText);
      return {
        error: `Failed to update booking: ${errorText}`,
      };
    }

    const result = await response.json();
    console.log("✅ Booking updated successfully:", result);

    return {
      success: true,
      message: `Booking updated successfully for ${customer_name}`,
      booking: result.booking,
    };
  } catch (error) {
    console.error("❌ Error updating booking:", error);
    return {
      error: `Failed to update booking: ${error.message}`,
    };
  }
}

/**
 * Cancel an existing booking
 * @param {Object} businessConfig - The business configuration
 * @param {Object} params - Parameters including customer details and booking info
 * @returns {Object} Cancellation result or error
 */
export async function cancelBooking(businessConfig, params) {
  try {
    console.log(
      "❌ cancelBooking called with params:",
      JSON.stringify(params, null, 2)
    );

    const { customer_name, date, time, reason } = params;
    const business = businessConfig.business;

    if (!business?.google_calendar_id) {
      console.error("❌ No Google Calendar connected for business");
      return { error: "Calendar not connected" };
    }

    // Call the internal Next.js API to cancel the booking
    const response = await fetch(
      `${config.nextjs.siteUrl}/api/voice/cancel-booking`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": config.nextjs.internalApiSecret,
        },
        body: JSON.stringify({
          business_id: business.id,
          customer_name,
          date,
          time,
          reason: reason || "Customer requested cancellation",
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Cancel booking API error:", response.status, errorText);
      return {
        error: `Failed to cancel booking: ${errorText}`,
      };
    }

    const result = await response.json();
    console.log("✅ Booking cancelled successfully:", result);

    return {
      success: true,
      message: `Booking cancelled successfully for ${customer_name}`,
      booking: result.booking,
    };
  } catch (error) {
    console.error("❌ Error cancelling booking:", error);
    return {
      error: `Failed to cancel booking: ${error.message}`,
    };
  }
}

/**
 * End the current Twilio call
 * @param {string} callSid - The Twilio call SID to terminate
 * @param {Object} params - Parameters including reason for ending the call
 * @returns {Object} Result of call termination or error
 */
export async function endCall(callSid, params) {
  try {
    console.log(
      "📞 endCall called with params:",
      JSON.stringify(params, null, 2)
    );
    console.log("📞 Call SID:", callSid);

    const { reason } = params;

    if (!callSid) {
      console.error("❌ No callSid available to end call");
      return { error: "Call ID not available" };
    }

    // Initialize Twilio client
    const twilio = (await import("twilio")).default(
      config.twilio.accountSid,
      config.twilio.authToken
    );

    console.log(`📞 Attempting to end call with SID: ${callSid}`);
    console.log(`📝 Reason: ${reason}`);

    // Update the call to completed status
    const call = await twilio.calls(callSid).update({
      status: "completed",
    });

    console.log(`✅ Call ended successfully:`, call.status);

    return {
      success: true,
      message: `Call ended: ${reason}`,
      callSid: callSid,
      status: call.status,
    };
  } catch (error) {
    console.error("❌ Error ending call:", error);
    return { error: "Failed to end call" };
  }
}
