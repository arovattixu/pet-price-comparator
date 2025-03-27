"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { productApi, compareApi, trendsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { useCompareStore } from "@/lib/stores/compareStore";
import { 
  ArrowLeft, 
  ShoppingCart, 
  Scale, 
  TrendingUp, 
  Maximize, 
  ListPlus, 
  Check 
} from "lucide-react";

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  
  const [product, setProduct] = useState<any>(null);
  const [similarProducts, setSimilarProducts] = useState<any[]>([]);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [savings, setSavings] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { addProduct, isInCompare, isCompareListFull } = useCompareStore();
  
  useEffect(() => {
    const fetchProductData = async () => {
      setLoading(true);
      
      try {
        // Fetch basic product data
        const productDetails = await productApi.getById(productId);
        setProduct(productDetails);
        
        // Only fetch additional data if product exists
        if (productDetails) {
          // Fetch remaining data in parallel
          const [productSimilar, priceHistoryData, savingsData] = await Promise.all([
            compareApi.getSimilarProducts(productId).catch(() => ({ similarProducts: [] })),
            trendsApi.getPriceHistory(productId).catch(() => ({ history: [] })),
            compareApi.calculateSavings(productId).catch(() => ({ savings: null }))
          ]);
          
          setSimilarProducts(productSimilar?.similarProducts || []);
          setPriceHistory(priceHistoryData?.history || []);
          setSavings(savingsData?.savings || null);
        }
      } catch (error) {
        console.error("Error fetching product data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProductData();
  }, [productId]);
  
  const handleAddToCompare = () => {
    if (!product) return;
    
    addProduct({
      id: product._id,
      name: product.name,
      brand: product.brand,
      imageUrl: product.imageUrl,
      price: product.price,
      source: product.source,
    });
  };
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('it-IT', { 
      style: 'currency', 
      currency: 'EUR' 
    }).format(price);
  };
  
  // Format price history data for chart
  const chartData = priceHistory.map(point => ({
    date: new Date(point.date).toLocaleDateString('it-IT', { 
      month: 'short', 
      day: 'numeric' 
    }),
    price: point.price
  }));
  
  if (loading) {
    return (
      <div className="container mx-auto max-w-5xl py-8">
        {/* Product skeleton */}
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-2/5 h-80 rounded-lg bg-muted/20 animate-pulse" />
          <div className="w-full md:w-3/5 space-y-4">
            <div className="h-8 w-3/4 bg-muted/20 animate-pulse rounded" />
            <div className="h-5 w-1/2 bg-muted/20 animate-pulse rounded" />
            <div className="h-10 w-1/3 bg-muted/20 animate-pulse rounded mt-4" />
            <div className="space-y-2 mt-4">
              <div className="h-4 w-full bg-muted/20 animate-pulse rounded" />
              <div className="h-4 w-full bg-muted/20 animate-pulse rounded" />
              <div className="h-4 w-2/3 bg-muted/20 animate-pulse rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!product) {
    return (
      <div className="container mx-auto max-w-5xl py-8">
        <h1 className="text-2xl font-bold mb-6">Product Not Found</h1>
        <p>The product you're looking for could not be found or is no longer available.</p>
        <Button 
          className="mt-4" 
          onClick={() => router.push('/products')}
        >
          Back to Products
        </Button>
      </div>
    );
  }
  
  const isProductInCompare = isInCompare(product._id);
  const isCompareDisabled = isCompareListFull() && !isProductInCompare;
  
  return (
    <div className="container mx-auto max-w-5xl py-8">
      {/* Back button */}
      <Button 
        variant="ghost" 
        className="mb-4" 
        onClick={() => router.back()}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>
      
      {/* Product main section */}
      <div className="flex flex-col md:flex-row gap-8 mb-8">
        {/* Product image */}
        <div className="w-full md:w-2/5">
          <div className="relative aspect-square bg-muted/10 rounded-lg overflow-hidden">
            <img 
              src={product.imageUrl || '/placeholder-product.jpg'} 
              alt={product.name}
              className="w-full h-full object-contain p-4"
            />
            
            {/* Source badge */}
            {product.source && (
              <Badge variant="secondary" className="absolute top-2 right-2">
                {product.source}
              </Badge>
            )}
            
            {/* Savings badge */}
            {savings && savings > 0 && (
              <Badge className="absolute bottom-2 left-2 bg-green-600 hover:bg-green-700">
                Save {formatPrice(savings)}
              </Badge>
            )}
          </div>
        </div>
        
        {/* Product info */}
        <div className="w-full md:w-3/5">
          <div className="mb-2">
            {product.brand && (
              <p className="text-lg text-muted-foreground">{product.brand}</p>
            )}
            <h1 className="text-3xl font-bold">{product.name}</h1>
          </div>
          
          {/* Price section */}
          <div className="my-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">
                {product.price ? formatPrice(product.price) : "Prezzo non disponibile"}
              </span>
              
              {product.priceUnit && (
                <span className="text-sm text-muted-foreground flex items-center">
                  <Scale className="h-4 w-4 mr-1" />
                  {product.priceUnit}
                </span>
              )}
            </div>
            
            {/* Best price indicator */}
            {savings === 0 && (
              <Badge variant="outline" className="mt-2 text-green-600 border-green-600">
                Best Price Available
              </Badge>
            )}
          </div>
          
          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 my-6">
            <Button
              className="flex-1 sm:flex-none"
              onClick={() => window.open(product.url, '_blank')}
              disabled={!product.url}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Buy Now
            </Button>
            
            <Button
              variant={isProductInCompare ? "secondary" : "outline"}
              className="flex-1 sm:flex-none"
              onClick={handleAddToCompare}
              disabled={isCompareDisabled}
            >
              {isProductInCompare ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Added to Compare
                </>
              ) : (
                <>
                  <ListPlus className="h-4 w-4 mr-2" />
                  Add to Compare
                </>
              )}
            </Button>
          </div>
          
          {/* Product details */}
          <div className="space-y-4">
            {product.description && (
              <div>
                <h3 className="font-medium mb-1">Description</h3>
                <p className="text-sm text-muted-foreground">{product.description}</p>
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {product.weight && (
                <div>
                  <span className="font-medium">Weight/Size: </span>
                  <span>{product.weight}</span>
                </div>
              )}
              
              {product.category && (
                <div>
                  <span className="font-medium">Category: </span>
                  <span>{product.category}</span>
                </div>
              )}
              
              {product.petType && (
                <div>
                  <span className="font-medium">Pet Type: </span>
                  <span>{product.petType === 'cane' ? 'Dog' : product.petType === 'gatto' ? 'Cat' : product.petType}</span>
                </div>
              )}
              
              <div>
                <span className="font-medium">Availability: </span>
                <span className={product.inStock !== false ? "text-green-600" : "text-red-600"}>
                  {product.inStock !== false ? 'In Stock' : 'Out of Stock'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <Separator className="my-8" />
      
      {/* Tabs section */}
      <Tabs defaultValue="price-history" className="mt-8">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="price-history">
            <TrendingUp className="h-4 w-4 mr-2" />
            Price History
          </TabsTrigger>
          <TabsTrigger value="similar-products">
            <Maximize className="h-4 w-4 mr-2" />
            Similar Products ({similarProducts.length})
          </TabsTrigger>
        </TabsList>
        
        {/* Price history tab */}
        <TabsContent value="price-history" className="mt-4">
          <div className="rounded-lg border p-4">
            <h3 className="text-lg font-medium mb-4">Price History</h3>
            
            {chartData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis 
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickMargin={10}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `€${value}`}
                      width={50}
                    />
                    <Tooltip
                      formatter={(value) => [`€${value}`, 'Price']}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={{ strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center py-12 text-muted-foreground">
                No price history available for this product.
              </p>
            )}
          </div>
        </TabsContent>
        
        {/* Similar products tab */}
        <TabsContent value="similar-products" className="mt-4">
          <div className="rounded-lg border p-4">
            <h3 className="text-lg font-medium mb-4">Similar Products</h3>
            
            {similarProducts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {similarProducts.map(similar => (
                  <div 
                    key={similar._id} 
                    className="flex flex-col border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => router.push(`/products/${similar._id}`)}
                  >
                    <div className="relative aspect-square bg-muted/10">
                      <img
                        src={similar.imageUrl || '/placeholder-product.jpg'}
                        alt={similar.name}
                        className="w-full h-full object-contain p-2"
                      />
                      
                      {/* Source badge */}
                      {similar.source && (
                        <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
                          {similar.source}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="p-3">
                      <p className="text-sm text-muted-foreground">{similar.brand}</p>
                      <h4 className="font-medium line-clamp-2">{similar.name}</h4>
                      <p className="font-bold mt-1">{formatPrice(similar.price)}</p>
                      
                      {similar.similarity && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Similarity score: {(similar.similarity * 100).toFixed(0)}%
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-12 text-muted-foreground">
                No similar products found.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 