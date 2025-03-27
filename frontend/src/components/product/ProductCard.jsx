'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  ShoppingCart, 
  ExternalLink, 
  Star, 
  ArrowsUpDown 
} from 'lucide-react';
import { useCompareStore } from '@/store/index';
import { useToast } from '@/components/ui/use-toast';
import Link from 'next/link';

const ProductCard = ({ product, variant, showSource = true }) => {
  const router = useRouter();
  const { addToCompare } = useCompareStore();
  const { toast } = useToast();
  
  const { title, imageUrl, source, rating, reviewCount } = product;
  const price = variant?.price || product.variants?.[0]?.currentPrice?.amount || 0;
  const isDiscounted = variant?.discounted || product.variants?.[0]?.currentPrice?.discounted || false;
  
  // Formatta il prezzo in Euro
  const formattedPrice = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(price);
  
  const handleCompareClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const added = addToCompare(product);
    
    if (added) {
      toast({
        title: "Prodotto aggiunto al confronto",
        description: "Vai alla pagina di confronto per vedere i dettagli",
        action: (
          <Button variant="outline" size="sm" onClick={() => router.push('/compare')}>
            Confronta ora
          </Button>
        ),
      });
    } else {
      toast({
        title: "Confronto completo",
        description: "Puoi confrontare al massimo 4 prodotti alla volta",
        variant: "destructive",
      });
    }
  };
  
  const visitProduct = (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(product.url, '_blank');
  };
  
  const viewDetails = () => {
    router.push(`/product/${product.id}`);
  };
  
  return (
    <Card className="h-full flex flex-col overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={viewDetails}>
      <CardHeader className="p-4 pb-0 relative">
        {isDiscounted && (
          <Badge variant="destructive" className="absolute top-2 right-2 z-10">
            Offerta
          </Badge>
        )}
        {showSource && source && (
          <Badge variant="outline" className="absolute top-2 left-2 z-10">
            {source === 'zooplus' ? 'Zooplus' : 'Arcaplanet'}
          </Badge>
        )}
        <div className="relative h-48 w-full overflow-hidden rounded-md">
          <img 
            src={imageUrl || '/images/placeholder-product.png'} 
            alt={title}
            className="h-full w-full object-contain"
          />
        </div>
      </CardHeader>
      
      <CardContent className="p-4 flex-grow">
        <h3 className="font-semibold leading-tight mb-1 line-clamp-2">{title}</h3>
        
        {rating > 0 && (
          <div className="flex items-center mb-2">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-3 w-3 ${
                  i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                }`}
              />
            ))}
            {reviewCount && (
              <span className="text-xs ml-1 text-muted-foreground">
                ({reviewCount})
              </span>
            )}
          </div>
        )}
        
        <div className="mt-2">
          <span className="text-xl font-bold">
            {formattedPrice}
          </span>
        </div>
        
        {product.variants && product.variants.length > 1 && (
          <div className="text-xs text-muted-foreground mt-1">
            {product.variants.length} varianti disponibili
          </div>
        )}
      </CardContent>
      
      <CardFooter className="p-4 pt-0 mt-auto">
        <div className="flex gap-2 w-full">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1" onClick={handleCompareClick}>
                  <ArrowsUpDown className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Confronta</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Aggiungi al confronto</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" className="flex-1" onClick={visitProduct}>
                  <ShoppingCart className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Acquista</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Visita il sito del rivenditore</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ProductCard; 