"use client";

import { useEffect, useState } from "react";
import { useCompareStore } from "@/lib/stores/compareStore";
import { ComparisonTable, ComparisonProduct } from "@/components/ui/comparison-table";
import { productApi, compareApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function ComparePage() {
  const router = useRouter();
  const { products, removeProduct, clearProducts } = useCompareStore();
  const [comparisonData, setComparisonData] = useState<ComparisonProduct[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchProductDetails = async () => {
      if (products.length === 0) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      
      try {
        // Fetch full details for each product
        const detailsPromises = products.map(product => 
          productApi.getById(product.id)
        );
        
        // Fetch savings calculation for each product
        const savingsPromises = products.map(product => 
          compareApi.calculateSavings(product.id)
            .catch(() => ({ savings: 0 })) // Handle errors gracefully
        );
        
        // Wait for all requests to complete
        const [detailsResults, savingsResults] = await Promise.all([
          Promise.all(detailsPromises),
          Promise.all(savingsPromises)
        ]);
        
        // Combine the data
        const enhancedProducts = detailsResults.map((details, index) => {
          const savings = savingsResults[index]?.savings || 0;
          
          // Extract attributes from the product details
          const { 
            _id, name, brand, price, source, imageUrl, 
            category, weight, inStock, ...restDetails 
          } = details;
          
          // Format as comparison product
          return {
            id: _id,
            name,
            brand,
            price,
            imageUrl,
            category,
            weight: weight || 'N/A',
            source,
            inStock,
            savings,
            // Extract any other attributes for comparison
            attributes: {
              ...restDetails,
              // Add any computed attributes
              pricePerKg: details.pricePerKg || 'N/A'
            }
          };
        });
        
        setComparisonData(enhancedProducts);
      } catch (error) {
        console.error("Error fetching product details:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProductDetails();
  }, [products]);
  
  // If no products, show empty state
  if (!loading && products.length === 0) {
    return (
      <div className="container mx-auto max-w-5xl py-12">
        <h1 className="text-3xl font-bold mb-6">Product Comparison</h1>
        
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-6 text-muted-foreground">
            <Trash2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-medium mb-2">No products to compare</h3>
            <p>Add products to your comparison list to see them here.</p>
          </div>
          
          <Button onClick={() => router.push('/products')}>
            Browse Products
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto max-w-5xl py-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Product Comparison</h1>
          <p className="text-muted-foreground">
            {products.length} {products.length === 1 ? 'product' : 'products'} being compared
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/products')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Products
          </Button>
          
          {products.length > 0 && (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => clearProducts()}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>
      </div>
      
      <Separator className="mb-6" />
      
      {loading ? (
        <div className="h-96 bg-muted/20 rounded-lg animate-pulse"></div>
      ) : (
        <ComparisonTable
          products={comparisonData}
          onRemoveProduct={removeProduct}
          onViewProduct={(productId) => router.push(`/products/${productId}`)}
          onBuyProduct={(productId, url) => window.open(url, '_blank')}
        />
      )}
    </div>
  );
} 