import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Package, DollarSign, Weight, ShoppingBag, MessageCircle, Shield, AlertTriangle } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  weight_kg: number;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalValue: 0,
    totalWeight: 0,
    totalOrders: 0,
    totalStock: 0,
    lowStockItems: 0,
  });

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
    const checkAdminAndFetchStats = async () => {
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

      setIsAdmin(true);
      fetchStats();
    };

    checkAdminAndFetchStats();
  }, [user, navigate]);

  const fetchStats = async () => {
    // Get products stats
    const { data: productsData } = await supabase.from("products").select("*").order("stock_quantity", { ascending: true });

    if (productsData) {
      setProducts(productsData);
      const totalValue = productsData.reduce((sum, p) => sum + p.price * p.stock_quantity, 0);
      const totalWeight = productsData.reduce((sum, p) => sum + p.weight_kg * p.stock_quantity, 0);
      const totalStock = productsData.reduce((sum, p) => sum + p.stock_quantity, 0);
      const lowStockItems = productsData.filter(p => p.stock_quantity < 10).length;

      setStats((prev) => ({
        ...prev,
        totalProducts: productsData.length,
        totalValue,
        totalWeight,
        totalStock,
        lowStockItems,
      }));
    }

    // Get orders count
    const { count } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true });

    if (count !== null) {
      setStats((prev) => ({ ...prev, totalOrders: count }));
    }
  };

  // Set up realtime subscription for product stock changes
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel('product-stock-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products'
        },
        (payload: any) => {
          const oldProduct = payload.old;
          const newProduct = payload.new;
          
          if (oldProduct.stock_quantity !== newProduct.stock_quantity) {
            const quantityChange = newProduct.stock_quantity - oldProduct.stock_quantity;
            const changeText = quantityChange < 0 ? `decreased by ${Math.abs(quantityChange)}` : `increased by ${quantityChange}`;
            
            toast.info(
              `Stock Alert: ${newProduct.name} stock ${changeText}. Remaining: ${newProduct.stock_quantity} units`,
              { duration: 5000 }
            );
            
            fetchStats();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  // Set up realtime subscription for new orders
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel('new-orders')
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
            `🛒 New Order Received! Order #${newOrder.id.slice(0, 8)} - Total: $${newOrder.total_amount.toFixed(2)}`,
            { 
              duration: 6000,
              className: "bg-success text-success-foreground border-success"
            }
          );
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <p>Checking permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Admin Dashboard</h1>
          <div className="flex gap-4">
            <Link to="/admin/products">
              <Button variant="outline" className="hover-lift">Manage Products</Button>
            </Link>
            <Link to="/admin/orders">
              <Button variant="outline" className="hover-lift">Manage Orders</Button>
            </Link>
            <Link to="/admin/chat">
              <Button variant="outline" className="hover-lift">
                <MessageCircle className="w-4 h-4 mr-2" />
                Customer Chat
              </Button>
            </Link>
            <Link to="/admin/management">
              <Button variant="outline" className="hover-lift">
                <Shield className="w-4 h-4 mr-2" />
                Admin Management
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProducts}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalStock} total items in stock
              </p>
              {stats.lowStockItems > 0 && (
                <p className="text-xs text-destructive mt-1">
                  ⚠️ {stats.lowStockItems} items low on stock
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalValue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Total stock value ({stats.totalStock} units)
              </p>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Weight</CardTitle>
              <Weight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalWeight.toFixed(2)} kg</div>
              <p className="text-xs text-muted-foreground">Total inventory weight</p>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
              <p className="text-xs text-muted-foreground">Orders received</p>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock Summary</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Total Units:</span>
                  <span className="font-semibold">{stats.totalStock}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Total Value:</span>
                  <span className="font-semibold">${stats.totalValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Average Value per Unit:</span>
                  <span className="font-semibold">
                    ${stats.totalStock > 0 ? (stats.totalValue / stats.totalStock).toFixed(2) : "0.00"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Product Inventory Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {products.map((product) => {
                const productValue = product.price * product.stock_quantity;
                const isLowStock = product.stock_quantity < 10;
                
                return (
                  <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{product.name}</h4>
                        {isLowStock && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Low Stock
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-8 text-sm">
                      <div className="text-right">
                        <p className="text-muted-foreground">Quantity</p>
                        <p className="font-semibold">{product.stock_quantity} units</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">Unit Price</p>
                        <p className="font-semibold">${product.price.toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">Total Value</p>
                        <p className="font-semibold text-primary">${productValue.toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">Weight</p>
                        <p className="font-semibold">{(product.weight_kg * product.stock_quantity).toFixed(2)} kg</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              <div className="pt-4 border-t mt-4">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Overall Totals</span>
                  <div className="flex gap-8">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground font-normal">Total Units</p>
                      <p>{stats.totalStock}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground font-normal">Total Value</p>
                      <p className="text-primary">${stats.totalValue.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground font-normal">Total Weight</p>
                      <p>{stats.totalWeight.toFixed(2)} kg</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Link to="/admin/products">
              <Button className="hover-lift">Add New Product</Button>
            </Link>
            <Link to="/admin/orders">
              <Button variant="outline" className="hover-lift">View Recent Orders</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
