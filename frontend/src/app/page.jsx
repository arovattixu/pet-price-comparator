'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PetSelector from '@/components/pet-filter/PetSelector';
import ProductCard from '@/components/product/ProductCard';
import { productService } from '@/services/api';

export default function HomePage() {
  const [popularProducts, setPopularProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchPopularProducts = async () => {
      try {
        // Fetch popular products for both dogs and cats
        const dogProducts = await productService.searchProducts({
          petType: 'dog',
          sort: 'popularity',
          limit: 4
        });
        
        const catProducts = await productService.searchProducts({
          petType: 'cat',
          sort: 'popularity',
          limit: 4
        });
        
        setPopularProducts({
          dog: dogProducts,
          cat: catProducts
        });
      } catch (error) {
        console.error('Error fetching popular products:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPopularProducts();
  }, []);
  
  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Risparmia sui prodotti per il tuo amico a 4 zampe
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-6">
                Confronta prezzi tra Zooplus e Arcaplanet per trovare le migliori offerte sui prodotti per il tuo pet
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" asChild>
                  <Link href="/search">Inizia a confrontare</Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link href="/about">Scopri di più</Link>
                </Button>
              </div>
            </div>
            <div className="justify-self-center">
              <PetSelector />
            </div>
          </div>
        </div>
      </section>
      
      {/* Popular Products */}
      <section className="container mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold mb-8 text-center">Prodotti Popolari</h2>
        
        <Tabs defaultValue="dog" className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList>
              <TabsTrigger value="dog">Cani</TabsTrigger>
              <TabsTrigger value="cat">Gatti</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="dog">
            {loading ? (
              <div className="text-center p-8">Caricamento prodotti...</div>
            ) : popularProducts.dog && popularProducts.dog.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {popularProducts.dog.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="text-center p-8">Nessun prodotto disponibile</div>
            )}
          </TabsContent>
          
          <TabsContent value="cat">
            {loading ? (
              <div className="text-center p-8">Caricamento prodotti...</div>
            ) : popularProducts.cat && popularProducts.cat.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {popularProducts.cat.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="text-center p-8">Nessun prodotto disponibile</div>
            )}
          </TabsContent>
        </Tabs>
        
        <div className="text-center mt-8">
          <Button variant="outline" asChild>
            <Link href="/search">Vedi tutti i prodotti</Link>
          </Button>
        </div>
      </section>
      
      {/* How It Works */}
      <section className="bg-slate-50 dark:bg-slate-900 py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8 text-center">Come Funziona</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center mb-4">
                  <div className="bg-primary/10 text-primary rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                    1
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Seleziona il tuo pet</h3>
                  <p className="text-muted-foreground">Personalizza la ricerca in base al tuo animale domestico</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-center mb-4">
                  <div className="bg-primary/10 text-primary rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                    2
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Trova prodotti</h3>
                  <p className="text-muted-foreground">Cerca tra migliaia di prodotti da diversi rivenditori</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-center mb-4">
                  <div className="bg-primary/10 text-primary rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                    3
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Confronta prezzi</h3>
                  <p className="text-muted-foreground">Confronta prezzi e caratteristiche per trovare la migliore offerta</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
} 