import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profiles?: {
    email: string;
    full_name?: string;
  };
}

const AdminManagement = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [admins, setAdmins] = useState<UserRole[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      navigate("/auth");
      return;
    }

    setUser(session.user);

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      toast.error("Access denied. Admin privileges required.");
      navigate("/");
      return;
    }

    setIsAdmin(true);
    loadAdmins();
    setLoading(false);
  };

  const loadAdmins = async () => {
    const { data, error } = await supabase
      .from("user_roles")
      .select(`
        *,
        profiles:user_id (
          email,
          full_name
        )
      `)
      .eq("role", "admin")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading admins:", error);
      return;
    }

    setAdmins(data || []);
  };

  const grantAdminAccess = async () => {
    if (!email.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    setSubmitting(true);

    try {
      // Call the database function to assign admin role
      const { error } = await supabase.rpc("assign_admin_role_to_email", {
        user_email: email.trim(),
      });

      if (error) {
        console.error("Error granting admin access:", error);
        toast.error("Failed to grant admin access. User may not exist.");
        return;
      }

      toast.success(`Admin access granted to ${email}`);
      setEmail("");
      loadAdmins();
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred");
    } finally {
      setSubmitting(false);
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

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            Admin Management
          </h1>
          <p className="text-muted-foreground">
            Grant admin privileges to users
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Grant Admin Access */}
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Grant Admin Access
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="email">User Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Enter the email of an existing user to grant them admin privileges
                </p>
              </div>
              <Button
                onClick={grantAdminAccess}
                disabled={submitting}
                className="w-full"
              >
                {submitting ? "Granting Access..." : "Grant Admin Access"}
              </Button>
            </CardContent>
          </Card>

          {/* Current Admins */}
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Current Admins ({admins.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {admins.map((admin) => (
                  <div
                    key={admin.id}
                    className="p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">
                          {(admin.profiles as any)?.full_name || "N/A"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {(admin.profiles as any)?.email || "N/A"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Since: {new Date(admin.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge className="bg-primary text-primary-foreground">
                        Admin
                      </Badge>
                    </div>
                  </div>
                ))}
                {admins.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No admins found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminManagement;
