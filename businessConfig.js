import { supabase } from "./database.js";

/**
 * Load complete business configuration including business details, config, and services
 * @param {string} businessId - The business ID to load configuration for
 * @returns {Object|null} Business configuration object or null if failed
 */
export async function loadBusinessConfig(businessId) {
  try {
    // Load business details
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .single();

    if (businessError || !business) {
      console.error("Failed to load business:", businessError);
      return null;
    }

    // Load business configuration
    const { data: config, error: configError } = await supabase
      .from("business_config")
      .select("*")
      .eq("business_id", businessId)
      .single();

    // Load active services
    const { data: services, error: servicesError } = await supabase
      .from("services")
      .select("*")
      .eq("business_id", businessId)
      .eq("is_active", true);

    // Load active staff members
    const { data: staffMembers, error: staffError } = await supabase
      .from("staff_members")
      .select("*")
      .eq("business_id", businessId)
      .eq("is_active", true);

    // Log Google Calendar connection status for debugging
    logGoogleCalendarStatus(business, config);

    return {
      business,
      config: config || null,
      services: services || [],
      staffMembers: staffMembers || [],
    };
  } catch (error) {
    console.error("Error loading business config:", error);
    return null;
  }
}

/**
 * Log Google Calendar connection status for debugging purposes
 * @param {Object} business - Business object
 * @param {Object} config - Business configuration object
 */
function logGoogleCalendarStatus(business, config) {
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
}

// Removed unused utility functions
