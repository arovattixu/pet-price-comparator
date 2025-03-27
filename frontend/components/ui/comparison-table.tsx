import { useState } from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ComparisonProduct {
  id: string;
  name: string;
  brand: string;
  imageUrl?: string;
  price?: number;
  priceUnit?: string; // Price per kg/unit
  category?: string;
  weight?: string;
  source?: string;
  savings?: number;
  url?: string;
  attributes?: Record<string, string | number | null>;
  inStock?: boolean;
}

interface ComparisonTableProps {
  products: ComparisonProduct[];
  onRemoveProduct?: (productId: string) => void;
  onViewProduct?: (productId: string) => void;
  onBuyProduct?: (productId: string, url: string) => void;
}

export function ComparisonTable({
  products,
  onRemoveProduct,
  onViewProduct,
  onBuyProduct,
}: ComparisonTableProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [startX, setStartX] = useState(0);
  
  // For mobile view, show a subset of products
  const productsPerPage = products.length <= 2 ? products.length : 
    window.innerWidth < 768 ? 1 : 2;
  const totalPages = Math.ceil(products.length / productsPerPage);
  
  const currentProducts = products.slice(
    currentPage * productsPerPage,
    (currentPage + 1) * productsPerPage
  );
  
  // Get all possible attribute keys from all products
  const allAttributeKeys = products.reduce((keys, product) => {
    if (product.attributes) {
      Object.keys(product.attributes).forEach(key => {
        if (!keys.includes(key)) {
          keys.push(key);
        }
      });
    }
    return keys;
  }, [] as string[]);
  
  // Handle touch events for mobile swiping
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setSwiping(true);
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swiping) return;
    
    const currentX = e.touches[0].clientX;
    const diff = startX - currentX;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentPage < totalPages - 1) {
        setCurrentPage(currentPage + 1);
      } else if (diff < 0 && currentPage > 0) {
        setCurrentPage(currentPage - 1);
      }
      
      setSwiping(false);
    }
  };
  
  const handleTouchEnd = () => {
    setSwiping(false);
  };
  
  return (
    <div className="w-full overflow-hidden" 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Mobile pagination controls */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mb-4 md:hidden">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <span className="text-sm">
            {currentPage + 1} / {totalPages}
          </span>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage === totalPages - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {/* Comparison table */}
      <ScrollArea className="w-full">
        <div className="min-w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Feature</TableHead>
                {currentProducts.map((product) => (
                  <TableHead key={product.id} className="min-w-[200px]">
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                        <span className="font-medium">{product.name}</span>
                        {onRemoveProduct && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onRemoveProduct(product.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {product.brand && (
                        <span className="text-sm text-muted-foreground">
                          {product.brand}
                        </span>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            
            <TableBody>
              {/* Image row */}
              <TableRow>
                <TableCell className="font-medium">Image</TableCell>
                {currentProducts.map((product) => (
                  <TableCell key={`${product.id}-image`}>
                    <div className="relative h-32 w-32 mx-auto">
                      <img
                        src={product.imageUrl || '/placeholder-product.jpg'}
                        alt={product.name}
                        className="object-contain h-full w-full"
                      />
                    </div>
                  </TableCell>
                ))}
              </TableRow>
              
              {/* Price row */}
              <TableRow>
                <TableCell className="font-medium">Price</TableCell>
                {currentProducts.map((product) => (
                  <TableCell key={`${product.id}-price`}>
                    <div className="flex flex-col">
                      <span className="text-lg font-bold">
                        {product.price ? `€${product.price.toFixed(2)}` : 'N/A'}
                      </span>
                      {product.priceUnit && (
                        <span className="text-xs text-muted-foreground">
                          {product.priceUnit}
                        </span>
                      )}
                    </div>
                  </TableCell>
                ))}
              </TableRow>
              
              {/* Savings row (if any product has savings) */}
              {products.some(p => p.savings !== undefined && p.savings > 0) && (
                <TableRow>
                  <TableCell className="font-medium">Potential Savings</TableCell>
                  {currentProducts.map((product) => (
                    <TableCell 
                      key={`${product.id}-savings`}
                      className={cn(
                        product.savings && product.savings > 0 
                          ? "text-green-600 dark:text-green-400" 
                          : ""
                      )}
                    >
                      {product.savings 
                        ? `Save €${product.savings.toFixed(2)}` 
                        : 'No savings'}
                    </TableCell>
                  ))}
                </TableRow>
              )}
              
              {/* Weight row */}
              <TableRow>
                <TableCell className="font-medium">Weight/Size</TableCell>
                {currentProducts.map((product) => (
                  <TableCell key={`${product.id}-weight`}>
                    {product.weight || 'N/A'}
                  </TableCell>
                ))}
              </TableRow>
              
              {/* Source/Store row */}
              <TableRow>
                <TableCell className="font-medium">Store</TableCell>
                {currentProducts.map((product) => (
                  <TableCell key={`${product.id}-source`}>
                    {product.source || 'N/A'}
                  </TableCell>
                ))}
              </TableRow>
              
              {/* Availability row */}
              <TableRow>
                <TableCell className="font-medium">Availability</TableCell>
                {currentProducts.map((product) => (
                  <TableCell key={`${product.id}-stock`}>
                    <span className={product.inStock !== false ? "text-green-600" : "text-red-600"}>
                      {product.inStock !== false ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </TableCell>
                ))}
              </TableRow>
              
              {/* Dynamic attribute rows */}
              {allAttributeKeys.map(key => (
                <TableRow key={`attribute-${key}`}>
                  <TableCell className="font-medium capitalize">
                    {key.replace(/_/g, ' ')}
                  </TableCell>
                  {currentProducts.map((product) => (
                    <TableCell key={`${product.id}-${key}`}>
                      {product.attributes?.[key] !== undefined && product.attributes[key] !== null
                        ? String(product.attributes[key])
                        : 'N/A'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              
              {/* Action buttons */}
              <TableRow>
                <TableCell className="font-medium">Actions</TableCell>
                {currentProducts.map((product) => (
                  <TableCell key={`${product.id}-actions`} className="space-y-2">
                    {onViewProduct && (
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => onViewProduct(product.id)}
                      >
                        View Details
                      </Button>
                    )}
                    {onBuyProduct && product.url && (
                      <Button 
                        className="w-full"
                        onClick={() => onBuyProduct(product.id, product.url!)}
                      >
                        Buy Now
                      </Button>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </ScrollArea>
      
      {/* Desktop pagination indicators */}
      {totalPages > 1 && (
        <div className="hidden md:flex justify-center gap-2 mt-4">
          {Array.from({ length: totalPages }).map((_, i) => (
            <Button
              key={i}
              variant={i === currentPage ? "default" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(i)}
            >
              {i + 1}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
} 