import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting payment verification");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { session_id } = await req.json();

    if (!session_id) {
      throw new Error("Session ID is required");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    console.log("Retrieving Stripe session:", session_id);

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      throw new Error("Payment not completed");
    }

    console.log("Payment verified, creating order");

    const metadata = session.metadata!;
    const userId = metadata.user_id;
    const totalAmount = parseFloat(metadata.total_amount);
    const paidAmount = parseFloat(metadata.paid_amount);
    const paymentOption = metadata.payment_option;

    // Fetch cart items for this user
    const { data: cartItems, error: cartError } = await supabaseClient
      .from("cart_items")
      .select(`
        *,
        products(*)
      `)
      .eq("user_id", userId);

    if (cartError || !cartItems || cartItems.length === 0) {
      throw new Error("Failed to fetch cart items");
    }

    // Create order
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .insert({
        user_id: userId,
        status: "pending",
        payment_status: paymentOption === "half" ? "partial" : "full",
        total_amount: totalAmount,
        paid_amount: paidAmount,
        street_address: metadata.street_address,
        apartment_suite: metadata.apartment_suite,
        city: metadata.city,
        state: metadata.state,
        zip_code: metadata.zip_code,
        delivery_notes: metadata.delivery_notes,
      })
      .select()
      .single();

    if (orderError) {
      console.error("Failed to create order:", orderError);
      throw new Error("Failed to create order");
    }

    console.log("Order created:", order.id);

    // Create order items
    const orderItems = cartItems.map((item: any) => ({
      order_id: order.id,
      product_id: item.products.id,
      quantity: item.quantity,
      price: item.products.price,
      weight_kg: item.products.weight_kg,
    }));

    const { error: itemsError } = await supabaseClient
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      console.error("Failed to create order items:", itemsError);
      throw new Error("Failed to create order items");
    }

    // Update stock quantities
    for (const item of cartItems) {
      const newStockQuantity = item.products.stock_quantity - item.quantity;

      await supabaseClient
        .from("products")
        .update({ stock_quantity: newStockQuantity })
        .eq("id", item.products.id);
    }

    // Clear cart
    await supabaseClient
      .from("cart_items")
      .delete()
      .eq("user_id", userId);

    console.log("Order completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        order_number: order.id.slice(0, 8).toUpperCase(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in verify-payment:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
