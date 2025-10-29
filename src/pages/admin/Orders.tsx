import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Order {
  id: string;
  status: string;
  payment_status: string;
  total_amount: number;
  paid_amount: number;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  created_at: string;
  approved: boolean;
  profiles: {
    full_name: string;
    email: string;
  };
}

const AdminOrders = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);

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
    const checkAdminAndFetch = async () => {
      if (!user) return;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        navigate("/");
        toast.error("Access denied");
        return;
      }

      fetchOrders();
    };

    checkAdminAndFetch();
  }, [user, navigate]);

  // Set up realtime subscription for new orders
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('new-orders-admin')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders'
        },
        (payload: any) => {
          const newOrder = payload.new;
          toast.success(
            `🛒 New Order Placed! Order #${newOrder.id.slice(0, 8)} - Total: $${newOrder.total_amount.toFixed(2)}`,
            { 
              duration: 6000,
              className: "bg-success text-success-foreground border-success"
            }
          );
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        profiles(full_name, email)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load orders");
      return;
    }

    setOrders(data || []);
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: status as any })
      .eq("id", orderId);

    if (error) {
      toast.error("Failed to update order status");
    } else {
      toast.success("Order status updated");
      fetchOrders();
    }
  };

  const approveOrder = async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ approved: true, status: "processing" })
      .eq("id", orderId);

    if (error) {
      toast.error("Failed to approve order");
    } else {
      toast.success("Order approved! Processing can begin.", {
        className: "bg-success text-success-foreground"
      });
      fetchOrders();
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500",
      paid_partial: "bg-blue-500",
      paid_full: "bg-green-500",
      processing: "bg-purple-500",
      shipped: "bg-indigo-500",
      delivered: "bg-green-600",
      cancelled: "bg-red-500",
    };
    return colors[status] || "bg-gray-500";
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">Manage Orders</h1>

        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Order #{order.id.slice(0, 8)}</p>
                    <p className="font-semibold">
                      {order.profiles.full_name || order.profiles.email}
                    </p>
                  </div>
                  <Badge className={getStatusColor(order.status)}>
                    {order.status.replace("_", " ")}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total Amount</p>
                    <p className="font-semibold">${order.total_amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Paid Amount</p>
                    <p className="font-semibold">${order.paid_amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Payment Status</p>
                    <p className="font-semibold capitalize">{order.payment_status}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Date</p>
                    <p className="font-semibold">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-muted-foreground">Delivery Address</p>
                  <p className="text-sm">
                    {order.street_address}, {order.city}, {order.state} {order.zip_code}
                  </p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {!order.approved && order.payment_status === "partial" && (
                    <Button
                      onClick={() => approveOrder(order.id)}
                      className="bg-success hover:bg-success/90 text-success-foreground"
                    >
                      Approve Order (Half Payment Received)
                    </Button>
                  )}
                  {order.approved && (
                    <Badge className="bg-success text-success-foreground">
                      ✓ Approved
                    </Badge>
                  )}
                  <Select
                    value={order.status}
                    onValueChange={(value) => updateOrderStatus(order.id, value)}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="paid_partial">Paid Partial</SelectItem>
                      <SelectItem value="paid_full">Paid Full</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="shipped">Shipped</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}

          {orders.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                No orders found
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminOrders;
