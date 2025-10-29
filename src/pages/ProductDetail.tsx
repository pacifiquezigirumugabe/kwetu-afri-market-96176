import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShoppingCart, ArrowLeft } from "lucide-react";

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  weight_kg: number;
  stock_quantity: number;
  image_url?: string;
  category?: string;
  youtube_link?: string;
}

interface Comment {
  id: string;
  comment: string;
  created_at: string;
  profiles: {
    full_name: string;
  };
}

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (id) {
      fetchProduct();
      fetchComments();
    }
  }, [id]);

  const fetchProduct = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      toast.error("Failed to load product");
      return;
    }

    setProduct(data);
  };

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from("product_comments")
      .select(`
        *,
        profiles(full_name)
      `)
      .eq("product_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load comments");
      return;
    }

    setComments(data || []);
  };

  const handleAddToCart = async () => {
    if (!user) {
      toast.error("Please sign in to add items to cart");
      navigate("/auth");
      return;
    }

    const { error } = await supabase.from("cart_items").upsert({
      user_id: user.id,
      product_id: id!,
      quantity: 1,
    });

    if (error) {
      toast.error("Failed to add to cart");
    } else {
      toast.success("Added to cart!");
    }
  };

  const handleAddComment = async () => {
    if (!user) {
      toast.error("Please sign in to comment");
      navigate("/auth");
      return;
    }

    if (!newComment.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    const { error } = await supabase.from("product_comments").insert({
      product_id: id!,
      user_id: user.id,
      comment: newComment,
    });

    if (error) {
      toast.error("Failed to add comment");
    } else {
      toast.success("Comment added!");
      setNewComment("");
      fetchComments();
    }
  };

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/products")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 w-4 h-4" />
          Back to Products
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="aspect-square bg-muted rounded-lg overflow-hidden">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingCart className="w-24 h-24 text-muted-foreground" />
              </div>
            )}
          </div>

          <div>
            <h1 className="text-4xl font-bold mb-4">{product.name}</h1>
            <p className="text-3xl font-bold text-primary mb-4">
              ${product.price.toFixed(2)}
            </p>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Weight:</span>
                <span className="font-medium">{product.weight_kg} kg</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Stock:</span>
                <span
                  className={`font-medium ${
                    product.stock_quantity > 0 ? "text-success" : "text-destructive"
                  }`}
                >
                  {product.stock_quantity > 0
                    ? `${product.stock_quantity} available`
                    : "Out of stock"}
                </span>
              </div>
              {product.category && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Category:</span>
                  <span className="font-medium">{product.category}</span>
                </div>
              )}
            </div>

            {product.description && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-2">Description</h2>
                <p className="text-muted-foreground">{product.description}</p>
              </div>
            )}

            {product.youtube_link && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-2">Product Video</h2>
                <div className="aspect-video rounded-lg overflow-hidden">
                  <iframe
                    width="100%"
                    height="100%"
                    src={product.youtube_link.replace('watch?v=', 'embed/')}
                    title="Product video"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
              </div>
            )}

            <Button
              onClick={handleAddToCart}
              disabled={product.stock_quantity === 0}
              size="lg"
              className="w-full"
            >
              <ShoppingCart className="mr-2 w-5 h-5" />
              Add to Cart
            </Button>
          </div>
        </div>

        {/* Comments Section */}
        <div className="max-w-3xl">
          <h2 className="text-2xl font-bold mb-6">Customer Reviews</h2>

          {user && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <Textarea
                  placeholder="Write your review..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="mb-4"
                />
                <Button onClick={handleAddComment}>Post Review</Button>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {comments.map((comment) => (
              <Card key={comment.id}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-semibold">{comment.profiles.full_name || "Anonymous"}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(comment.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-muted-foreground">{comment.comment}</p>
                </CardContent>
              </Card>
            ))}

            {comments.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No reviews yet. Be the first to review!
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
