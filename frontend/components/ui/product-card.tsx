import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useCompareStore } from "@/lib/stores/compareStore";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Check, Scale, ExternalLink } from "lucide-react";

interface Product {
  id?: string;
  _id?: string;
  name: string;
  brand: string;
  price?: number;
  priceUnit?: string;
  imageUrl?: string;
  source?: string;
  inStock?: boolean;
  category?: string;
  savings?: number;
  url?: string;
}

interface ProductCardProps {
  product: Product;
  onClick?: () => void;
  onAddToCompare?: () => void;
  onBuy?: () => void;
  showBuyButton?: boolean;
}

export function ProductCard({
  product,
  onClick,
  onAddToCompare,
  onBuy,
  showBuyButton = false,
}: ProductCardProps) {
  const { addProduct, isInCompare, isCompareListFull } = useCompareStore();
  
  const handleAddToCompare = () => {
    const productId = product._id || product.id;
    
    if (!productId) {
      console.error("Product has no ID", product);
      return;
    }
    
    if (onAddToCompare) {
      onAddToCompare();
    } else {
      addProduct({
        id: productId,
        name: product.name,
        brand: product.brand,
        imageUrl: product.imageUrl,
        price: product.price,
        source: product.source,
      });
    }
  };
  
  const isAlreadyInCompare = isInCompare(product._id || product.id || '');
  const compareListFull = isCompareListFull();
  
  return (
    <Card className={cn(
      "overflow-hidden transition-shadow hover:shadow-md",
      onClick && "cursor-pointer"
    )}>
      {/* Image section */}
      <div 
        className="aspect-square relative overflow-hidden bg-muted/20"
        onClick={onClick}
      >
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="object-contain w-full h-full p-2"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            No image
          </div>
        )}
        
        {/* Source badge */}
        {product.source && (
          <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
            {product.source}
          </Badge>
        )}
        
        {/* Savings badge */}
        {product.savings && product.savings > 0 && (
          <Badge className="absolute bottom-2 left-2 bg-green-600 hover:bg-green-700 text-xs">
            Save €{product.savings.toFixed(2)}
          </Badge>
        )}
      </div>
      
      {/* Content section */}
      <CardContent className="p-4" onClick={onClick}>
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground">{product.brand}</p>
          <h3 className="font-semibold line-clamp-2">{product.name}</h3>
          
          {product.price !== undefined && (
            <div className="mt-2">
              <div className="font-bold">€{product.price.toFixed(2)}</div>
              {product.priceUnit && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Scale className="h-3 w-3" />
                  {product.priceUnit}
                </div>
              )}
            </div>
          )}
          
          {product.inStock === false && (
            <p className="text-sm text-red-500">Out of stock</p>
          )}
        </div>
      </CardContent>
      
      {/* Footer with actions */}
      <CardFooter className="p-4 pt-0 flex gap-2">
        <Button
          variant={isAlreadyInCompare ? "secondary" : "outline"}
          size="sm"
          className="flex-1"
          onClick={handleAddToCompare}
          disabled={!isAlreadyInCompare && compareListFull}
        >
          {isAlreadyInCompare ? (
            <>
              <Check className="h-4 w-4 mr-1" />
              Added
            </>
          ) : (
            <>
              <PlusCircle className="h-4 w-4 mr-1" />
              Compare
            </>
          )}
        </Button>
        
        {showBuyButton && product.url && (
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={onBuy || (() => window.open(product.url, '_blank'))}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Buy
          </Button>
        )}
      </CardFooter>
    </Card>
  );
} 