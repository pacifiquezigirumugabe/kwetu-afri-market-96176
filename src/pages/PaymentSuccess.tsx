import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);
  const [orderNumber, setOrderNumber] = useState<string>("");

  useEffect(() => {
    const verifyPayment = async () => {
      const sessionId = searchParams.get("session_id");

      if (!sessionId) {
        toast.error("Invalid payment session");
        navigate("/");
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("verify-payment", {
          body: { session_id: sessionId },
        });

        if (error) {
          throw error;
        }

        if (data?.success) {
          setOrderNumber(data.order_number);
          toast.success("Payment successful! Your order has been placed.");
        }
      } catch (error: any) {
        console.error("Payment verification error:", error);
        toast.error("Failed to verify payment. Please contact support.");
      } finally {
        setIsProcessing(false);
      }
    };

    verifyPayment();
  }, [searchParams, navigate]);

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="py-16 text-center">
              <Loader2 className="w-16 h-16 mx-auto mb-4 text-primary animate-spin" />
              <h2 className="text-2xl font-bold mb-2">Processing Payment...</h2>
              <p className="text-muted-foreground">Please wait while we confirm your payment</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-16">
        <Card className="w-full max-w-2xl mx-auto">
          <CardContent className="py-16 text-center">
            <CheckCircle className="w-20 h-20 mx-auto mb-6 text-green-500" />
            <h1 className="text-4xl font-bold mb-4">Payment Successful!</h1>
            <p className="text-xl text-muted-foreground mb-2">
              Thank you for your order
            </p>
            {orderNumber && (
              <p className="text-lg mb-8">
                Order Number: <span className="font-bold text-primary">{orderNumber}</span>
              </p>
            )}
            <p className="text-muted-foreground mb-8">
              We've received your payment and your order is being processed.
              You'll receive a confirmation email shortly.
            </p>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => navigate("/customer-dashboard")} size="lg">
                View Orders
              </Button>
              <Button onClick={() => navigate("/products")} variant="outline" size="lg">
                Continue Shopping
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PaymentSuccess;
