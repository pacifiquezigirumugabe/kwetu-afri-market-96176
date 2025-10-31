import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CartItem {
  id: string;
  quantity: number;
  products: {
    id: string;
    name: string;
    price: number;
    weight_kg: number;
    stock_quantity: number;
  };
}

const Checkout = () => {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentOption, setPaymentOption] = useState("half");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        navigate("/auth");
      }
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (roleData) {
        setIsAdmin(true);
        toast.error("Administrators cannot make purchases. Please use a customer account.");
        navigate("/admin/dashboard");
      }
    };

    if (user) {
      checkAdmin();
      fetchCart();
    }
  }, [user, navigate]);

  const fetchCart = async () => {
    const { data, error } = await supabase
      .from("cart_items")
      .select(`
        *,
        products(*)
      `)
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to load cart");
      return;
    }

    if (!data || data.length === 0) {
      navigate("/cart");
      return;
    }

    setCartItems(data);
  };

  const totalAmount = cartItems.reduce(
    (sum, item) => sum + item.products.price * item.quantity,
    0
  );

  const paidAmount = paymentOption === "half" ? totalAmount / 2 : totalAmount;

  const handleSubmitOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          paymentOption,
          deliveryAddress: {
            street_address: formData.get("street_address") as string,
            apartment_suite: formData.get("apartment_suite") as string,
            city: formData.get("city") as string,
            state: "NY",
            zip_code: formData.get("zip_code") as string,
            delivery_notes: formData.get("delivery_notes") as string,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data?.url) {
        window.open(data.url, "_blank");
        toast.success("Redirecting to payment...");
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast.error(error.message || "Failed to initiate checkout");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">Checkout</h1>

        <form onSubmit={handleSubmitOrder}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Delivery Address</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="street_address">Street Address *</Label>
                    <Input id="street_address" name="street_address" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apartment_suite">Apartment/Suite</Label>
                    <Input id="apartment_suite" name="apartment_suite" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City *</Label>
                      <Input id="city" name="city" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input id="state" name="state" value="NY" readOnly />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip_code">ZIP Code *</Label>
                    <Input id="zip_code" name="zip_code" required pattern="[0-9]{5}" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="delivery_notes">Delivery Notes</Label>
                    <Textarea
                      id="delivery_notes"
                      name="delivery_notes"
                      placeholder="Any special instructions for delivery..."
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Payment Options</CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={paymentOption} onValueChange={setPaymentOption}>
                    <div className="flex items-center space-x-2 mb-3">
                      <RadioGroupItem value="half" id="half" />
                      <Label htmlFor="half" className="cursor-pointer">
                        Pay 50% now (${(totalAmount / 2).toFixed(2)}), remaining on delivery
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="full" id="full" />
                      <Label htmlFor="full" className="cursor-pointer">
                        Pay full amount now (${totalAmount.toFixed(2)})
                      </Label>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>
            </div>

            <div>
              <Card className="sticky top-20">
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>
                        {item.products.name} x {item.quantity}
                      </span>
                      <span className="font-medium">
                        ${(item.products.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}

                  <div className="border-t pt-4 space-y-3">
                    <div className="flex justify-between font-semibold">
                      <span>Total:</span>
                      <span className="text-primary">${totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Amount to pay now:</span>
                      <span className="font-medium">${paidAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  <Button type="submit" size="lg" className="w-full" disabled={isLoading || isAdmin}>
                    {isAdmin ? "Admin Cannot Place Orders" : isLoading ? "Processing..." : "Proceed to Payment"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Checkout;
