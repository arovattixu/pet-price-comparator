'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { productService } from '@/services/api';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PriceHistory from '@/components/product/PriceHistory';
import { Star, ArrowLeft, ExternalLink, ShoppingCart } from 'lucide-react';
import { useCompareStore } from '@/store';
import { useToast } from '@/components/ui/use-toast';
import PriceAlertForm from '@/components/price-alerts/PriceAlertForm';
import { Toaster } from 'react-hot-toast';

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.id;
  const { addToCompare } = useCompareStore();
  const { toast } = useToast();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [showAlertForm, setShowAlertForm] = useState(false);
  
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const data = await productService.getProduct(productId);
        setProduct(data);
        
        // Seleziona la prima variante come default
        if (data.variants && data.variants.length > 0) {
          setSelectedVariant(data.variants[0]);
        }
      } catch (err) {
        console.error('Error fetching product:', err);
        setError('Impossibile caricare i dettagli del prodotto');
      } finally {
        setLoading(false);
      }
    };
    
    if (productId) {
      fetchProduct();
    }
  }, [productId]);
  
  const handleAddToCompare = () => {
    if (product) {
      const added = addToCompare(product);
      
      if (added) {
        toast({
          title: "Prodotto aggiunto al confronto",
          description: "Vai alla pagina di confronto per vedere i dettagli",
          action: (
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/compare'}>
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
    }
  };
  
  const visitProduct = () => {
    if (product) {
      window.open(product.url, '_blank');
    }
  };
  
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-64 mt-2" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Skeleton className="h-96 w-full" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    );
  }
  
  if (error || !product) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Errore</h1>
        <p className="text-red-500 mb-4">{error || 'Prodotto non trovato'}</p>
        <Button asChild>
          <Link href="/search">Torna alla ricerca</Link>
        </Button>
      </div>
    );
  }
  
  const currentVariant = selectedVariant || (product.variants?.[0] || null);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <Toaster position="top-right" />
      
      <div className="mb-6">
        <Link href="/search" className="inline-flex items-center text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Torna alla ricerca
        </Link>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Product Image */}
        <Card>
          <CardContent className="p-6">
            <div className="relative h-80 w-full">
              <Image
                src={product.imageUrl || '/images/placeholder-product.png'}
                alt={product.title}
                fill
                className="object-contain"
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Product Info */}
        <div>
          <Badge variant="outline" className="mb-2">
            {product.source === 'zooplus' ? 'Zooplus' : 'Arcaplanet'}
          </Badge>
          
          <h1 className="text-2xl font-bold mb-2">{product.title}</h1>
          
          {product.rating && (
            <div className="flex items-center mb-4">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-5 w-5 ${
                    i < product.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                  }`}
                />
              ))}
              {product.reviewCount && (
                <span className="text-sm ml-2 text-muted-foreground">
                  ({product.reviewCount} recensioni)
                </span>
              )}
            </div>
          )}
          
          {product.variants && product.variants.length > 0 && (
            <div className="mb-4">
              <label htmlFor="variant-select" className="block text-sm font-medium mb-2">
                Varianti
              </label>
              <Select 
                value={currentVariant?.variantId} 
                onValueChange={(value) => {
                  const variant = product.variants.find(v => v.variantId === value);
                  setSelectedVariant(variant);
                }}
              >
                <SelectTrigger id="variant-select" className="w-full">
                  <SelectValue placeholder="Seleziona variante" />
                </SelectTrigger>
                <SelectContent>
                  {product.variants.map((variant) => (
                    <SelectItem key={variant.variantId} value={variant.variantId}>
                      {variant.description} - € {variant.price?.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {currentVariant && (
            <div className="mb-6">
              <div className="text-3xl font-bold">
                € {currentVariant.price?.toFixed(2)}
              </div>
              {currentVariant.discounted && (
                <div className="text-red-500 text-sm font-medium mt-1">
                  In offerta! {currentVariant.discountAmount}
                </div>
              )}
            </div>
          )}
          
          <div className="space-y-4">
            <Button className="w-full" onClick={visitProduct}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Visita rivenditore
            </Button>
            
            <Button variant="outline" className="w-full" onClick={handleAddToCompare}>
              Aggiungi al confronto
            </Button>
            
            <Button 
              variant="secondary" 
              className="w-full" 
              onClick={() => setShowAlertForm(!showAlertForm)}
            >
              {showAlertForm ? 'Nascondi avviso prezzo' : 'Crea avviso prezzo'}
            </Button>
            
            {showAlertForm && (
              <div className="mt-4">
                <PriceAlertForm 
                  product={product} 
                  variant={currentVariant} 
                  onSuccess={() => setShowAlertForm(false)}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Product Details Tabs */}
      <Tabs defaultValue="description" className="mb-8">
        <TabsList className="w-full max-w-md mx-auto grid grid-cols-3">
          <TabsTrigger value="description">Descrizione</TabsTrigger>
          <TabsTrigger value="details">Dettagli</TabsTrigger>
          <TabsTrigger value="price-history">Storico Prezzi</TabsTrigger>
        </TabsList>
        
        <TabsContent value="description" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <div dangerouslySetInnerHTML={{ __html: product.description }} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="details" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {product.brand && (
                  <div>
                    <h3 className="font-medium">Marca</h3>
                    <p>{product.brand}</p>
                  </div>
                )}
                
                {product.petType && (
                  <div>
                    <h3 className="font-medium">Tipo di Animale</h3>
                    <p>{product.petType === 'dog' ? 'Cane' : 'Gatto'}</p>
                  </div>
                )}
                
                {product.features && Object.entries(product.features).map(([key, value]) => (
                  <div key={key}>
                    <h3 className="font-medium">{key.charAt(0).toUpperCase() + key.slice(1)}</h3>
                    <p>{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="price-history" className="mt-4">
          <PriceHistory 
            productId={product.id} 
            variantId={currentVariant?.variantId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
} 