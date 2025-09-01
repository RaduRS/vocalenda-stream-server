import { createClient } from "@supabase/supabase-js";
import { getConfig } from "./config.js";

/**
 * Initialize and export Supabase client
 */
function createSupabaseClient() {
  const config = getConfig();

  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    throw new Error(
      "Supabase configuration is missing. Please check your environment variables."
    );
  }

  return createClient(config.supabase.url, config.supabase.serviceRoleKey);
}

// Export the initialized Supabase client
export const supabase = createSupabaseClient();

/**
 * Database utility functions
 */
export const db = {
  /**
   * Get a business configuration by ID
   */
  async getBusinessConfig(businessId) {
    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .single();

    if (error) {
      throw new Error(`Failed to load business config: ${error.message}`);
    }

    return data;
  },

  /**
   * Create a new booking record
   */
  async createBooking(bookingData) {
    const { data, error } = await supabase
      .from("bookings")
      .insert(bookingData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create booking: ${error.message}`);
    }

    return data;
  },

  /**
   * Update a booking record
   */
  async updateBooking(bookingId, updates) {
    const { data, error } = await supabase
      .from("bookings")
      .update(updates)
      .eq("id", bookingId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update booking: ${error.message}`);
    }

    return data;
  },

  /**
   * Get bookings for a business within a date range
   */
  async getBookings(businessId, startDate, endDate) {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("business_id", businessId)
      .gte("start_time", startDate)
      .lte("start_time", endDate)
      .order("start_time", { ascending: true });

    if (error) {
      throw new Error(`Failed to get bookings: ${error.message}`);
    }

    return data || [];
  },
};
