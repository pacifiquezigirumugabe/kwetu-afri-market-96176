import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Package, MessageCircle, ShoppingCart, User, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Order {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  payment_status: string;
}

interface Conversation {
  id: string;
  status: string;
  updated_at: string;
  created_at: string;
}

interface Message {
  id: string;
  message: string;
  sender_type: string;
  created_at: string;
  conversation_id: string;
}

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      loadDashboardData(session.user.id);
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

  const loadDashboardData = async (userId: string) => {
    setLoading(true);

    // Load orders
    const { data: ordersData } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (ordersData) setOrders(ordersData);

    // Load conversations
    const { data: conversationsData } = await supabase
      .from("chat_conversations")
      .select("*")
      .eq("customer_id", userId)
      .order("updated_at", { ascending: false });

    if (conversationsData) {
      setConversations(conversationsData);
      
      // Load messages for all conversations
      if (conversationsData.length > 0) {
        const conversationIds = conversationsData.map(c => c.id);
        const { data: messagesData } = await supabase
          .from("chat_messages")
          .select("*")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: true });

        if (messagesData) setMessages(messagesData);
      }
    }

    // Load profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileData) setProfile(profileData);

    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "bg-success text-success-foreground";
      case "processing":
        return "bg-accent text-accent-foreground";
      case "pending":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-success text-success-foreground";
      case "partial":
        return "bg-accent text-accent-foreground";
      default:
        return "bg-destructive text-destructive-foreground";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome back, {profile?.full_name || user?.email}</h1>
          <p className="text-muted-foreground">Manage your orders and messages</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="hover:shadow-lg transition-all duration-300 hover:scale-105">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Package className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{orders.length}</p>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-300 hover:scale-105">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{conversations.length}</p>
                  <p className="text-sm text-muted-foreground">Conversations</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Link to="/products" className="block">
            <Card className="hover:shadow-lg transition-all duration-300 hover:scale-105 h-full">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center">
                    <ShoppingCart className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">Shop</p>
                    <p className="text-sm text-muted-foreground">Browse Products</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/chat" className="block">
            <Card className="hover:shadow-lg transition-all duration-300 hover:scale-105 h-full">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">Chat</p>
                    <p className="text-sm text-muted-foreground">Get Support</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Orders */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Recent Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length > 0 ? (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold">Order #{order.id.slice(0, 8)}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">${order.total_amount.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                        <Badge className={getPaymentStatusColor(order.payment_status)}>
                          {order.payment_status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No orders yet</p>
                  <Link to="/products">
                    <Button className="mt-4">Start Shopping</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Messages from Support */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Messages from Support
              </CardTitle>
            </CardHeader>
            <CardContent>
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No messages yet</p>
                  <Link to="/chat">
                    <Button className="mt-4">Start a Conversation</Button>
                  </Link>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4 pr-4">
                    {conversations.map((conv) => {
                      const convMessages = messages.filter(m => m.conversation_id === conv.id);
                      if (convMessages.length === 0) return null;
                      
                      return (
                        <div key={conv.id} className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                          <div className="flex justify-between items-center mb-3 pb-2 border-b">
                            <span className="font-medium flex items-center gap-2">
                              <MessageCircle className="w-4 h-4" />
                              Support Chat
                            </span>
                            <Badge className={conv.status === "active" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}>
                              {conv.status}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {convMessages.slice(-3).map((msg) => (
                              <div
                                key={msg.id}
                                className={`flex ${
                                  msg.sender_type === "customer" ? "justify-end" : "justify-start"
                                }`}
                              >
                                <div
                                  className={`max-w-[85%] rounded-lg p-3 ${
                                    msg.sender_type === "customer"
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted"
                                  }`}
                                >
                                  <p className="text-sm">{msg.message}</p>
                                  <p className="text-xs opacity-70 mt-1 flex items-center gap-1">
                                    {msg.sender_type === "admin" ? "Support" : "You"} • 
                                    <Clock className="w-3 h-3" />
                                    {new Date(msg.created_at).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <Link to="/chat">
                            <Button variant="outline" size="sm" className="w-full mt-3">
                              View Full Conversation
                            </Button>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;
