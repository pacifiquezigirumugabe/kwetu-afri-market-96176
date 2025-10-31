import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckoutRequest {
  paymentOption: 'half' | 'full';
  deliveryAddress: {
    street_address: string;
    apartment_suite?: string;
    city: string;
    state: string;
    zip_code: string;
    delivery_notes?: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting checkout process");
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    if (!user?.email) {
      throw new Error("User not authenticated");
    }

    console.log("User authenticated:", user.email);

    const { paymentOption, deliveryAddress }: CheckoutRequest = await req.json();

    // Fetch cart items
    const { data: cartItems, error: cartError } = await supabaseClient
      .from("cart_items")
      .select(`
        *,
        products(*)
      `)
      .eq("user_id", user.id);

    if (cartError || !cartItems || cartItems.length === 0) {
      throw new Error("Cart is empty or failed to fetch cart");
    }

    console.log("Cart items fetched:", cartItems.length);

    const totalAmount = cartItems.reduce(
      (sum: number, item: any) => sum + item.products.price * item.quantity,
      0
    );

    const paidAmount = paymentOption === "half" ? totalAmount / 2 : totalAmount;

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      console.log("Existing customer found:", customerId);
    }

    // Create line items for Stripe
    const lineItems = cartItems.map((item: any) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.products.name,
          description: `${item.products.weight_kg} kg`,
        },
        unit_amount: Math.round(
          (paymentOption === "half" ? item.products.price / 2 : item.products.price) * 100
        ),
      },
      quantity: item.quantity,
    }));

    console.log("Creating Stripe checkout session");

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: lineItems,
      mode: "payment",
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/checkout`,
      metadata: {
        user_id: user.id,
        payment_option: paymentOption,
        total_amount: totalAmount.toString(),
        paid_amount: paidAmount.toString(),
        street_address: deliveryAddress.street_address,
        apartment_suite: deliveryAddress.apartment_suite || "",
        city: deliveryAddress.city,
        state: deliveryAddress.state,
        zip_code: deliveryAddress.zip_code,
        delivery_notes: deliveryAddress.delivery_notes || "",
      },
    });

    console.log("Checkout session created:", session.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in create-checkout:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
