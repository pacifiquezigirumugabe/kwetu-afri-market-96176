import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  weight_kg: number;
  stock_quantity: number;
  image_url?: string;
  onAddToCart?: () => void;
}

const ProductCard = ({ id, name, price, weight_kg, stock_quantity, image_url, onAddToCart }: ProductCardProps) => {
  return (
    <Card className="group card-interactive">
      <Link to={`/products/${id}`}>
        <div className="aspect-square overflow-hidden rounded-t-lg bg-muted">
          {image_url ? (
            <img
              src={image_url}
              alt={name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingCart className="w-12 h-12 text-muted-foreground group-hover:scale-110 transition-transform" />
            </div>
          )}
        </div>
      </Link>
      <CardContent className="p-4">
        <Link to={`/products/${id}`}>
          <h3 className="font-semibold text-lg mb-2 hover:text-primary transition-colors hover-underline">
            {name}
          </h3>
        </Link>
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>{weight_kg} kg</span>
          <span className={stock_quantity > 0 ? "text-success" : "text-destructive"}>
            {stock_quantity > 0 ? `${stock_quantity} in stock` : "Out of stock"}
          </span>
        </div>
        <p className="text-2xl font-bold text-primary">${price.toFixed(2)}</p>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button
          onClick={onAddToCart}
          disabled={stock_quantity === 0}
          className="w-full hover-lift"
          variant="default"
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          Add to Cart
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ProductCard;
