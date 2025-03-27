'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { compareService } from '@/services/api';
import ProductCard from '@/components/product/ProductCard';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Filter, Loader2, SlidersHorizontal, X } from 'lucide-react';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('query') || '');
  const [petType, setPetType] = useState(searchParams.get('petType') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('price_asc');
  const [priceRange, setPriceRange] = useState([0, 100]);
  const [brands, setBrands] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [sources, setSources] = useState([
    { id: 'zooplus', name: 'Zooplus', checked: true },
    { id: 'arcaplanet', name: 'Arcaplanet', checked: true }
  ]);
  
  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        const query = searchParams.get('query');
        const category = searchParams.get('category');
        const petType = searchParams.get('petType');
        
        if (!query && !category) {
          setResults([]);
          setLoading(false);
          return;
        }
        
        const params = {
          query: query || undefined,
          category: category || undefined,
          petType: petType || undefined
        };
        
        const data = await compareService.searchAndCompare(params);
        setResults(data.matches || []);
        
        // Extract unique brands from results
        if (data.matches && data.matches.length > 0) {
          const uniqueBrands = [...new Set(data.matches.flatMap(match => 
            match.products.filter(item => item.brand).map(item => item.brand)
          ))].sort();
          
          setBrands(uniqueBrands.map(brand => ({
            id: brand,
            name: brand,
            checked: false
          })));
        }
      } catch (err) {
        console.error('Error fetching results:', err);
        setError('Si è verificato un errore durante la ricerca. Riprova più tardi.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchResults();
  }, [searchParams]);
  
  const handleSearch = () => {
    // Redirect to the same page with updated query params
    const params = new URLSearchParams();
    if (searchTerm) params.set('query', searchTerm);
    if (petType) params.set('petType', petType);
    if (category) params.set('category', category);
    window.location.href = `/search?${params.toString()}`;
  };
  
  const toggleBrand = (brandId) => {
    setSelectedBrands(prev => 
      prev.includes(brandId)
        ? prev.filter(id => id !== brandId)
        : [...prev, brandId]
    );
  };
  
  const toggleSource = (sourceId) => {
    setSources(prev => prev.map(source => 
      source.id === sourceId 
        ? { ...source, checked: !source.checked }
        : source
    ));
  };
  
  const resetFilters = () => {
    setSelectedBrands([]);
    setPriceRange([0, 100]);
    setSources(sources.map(source => ({ ...source, checked: true })));
  };
  
  // Flatten and filter the results structure
  const getAllProducts = () => {
    if (!results || results.length === 0) return [];
    return results.flatMap(match => match.products);
  };
  
  const applyFilters = (items) => {
    if (!items || items.length === 0) return [];
    
    return items.filter(item => {
      // Filter by price
      const itemPrice = item.variants && item.variants.length > 0
        ? Math.min(...item.variants.map(v => v.price || Infinity))
        : (item.price?.current || 0);
      
      const minPrice = priceRange[0];
      const maxPrice = priceRange[1];
      const priceMatch = itemPrice >= minPrice && itemPrice <= maxPrice;
      
      // Filter by brand
      const brandMatch = selectedBrands.length === 0 || 
        (item.brand && selectedBrands.includes(item.brand));
      
      // Filter by source
      const checkedSources = sources.filter(s => s.checked).map(s => s.id);
      const sourceMatch = checkedSources.includes(item.source);
      
      return priceMatch && brandMatch && sourceMatch;
    });
  };
  
  const sortItems = (items) => {
    if (!items || items.length === 0) return [];
    
    return [...items].sort((a, b) => {
      const priceA = a.variants && a.variants.length > 0
        ? Math.min(...a.variants.map(v => v.price || Infinity))
        : (a.price?.current || 0);
      
      const priceB = b.variants && b.variants.length > 0
        ? Math.min(...b.variants.map(v => v.price || Infinity))
        : (b.price?.current || 0);
      
      switch (sortBy) {
        case 'price_asc':
          return priceA - priceB;
        case 'price_desc':
          return priceB - priceA;
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'reviews':
          return (b.reviewCount || 0) - (a.reviewCount || 0);
        default:
          return 0;
      }
    });
  };
  
  const allProducts = getAllProducts();
  const filteredResults = sortItems(applyFilters(allProducts));
  
  const getTitle = () => {
    if (searchParams.get('query')) {
      return `Risultati per: "${searchParams.get('query')}"`;
    } else if (category) {
      const categoryName = category.replace(/_/g, ' ').replace(/\w\S*/g, 
        txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
      );
      return categoryName;
    } else {
      return 'Tutti i prodotti';
    }
  };
  
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">{getTitle()}</h1>
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex-grow max-w-lg">
            <Input 
              type="text" 
              placeholder="Cerca prodotti..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button onClick={handleSearch}>
            <Search className="h-4 w-4 mr-2" />
            Cerca
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtri
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar Filters */}
        <div className={`${showFilters ? 'block' : 'hidden'} md:block`}>
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Filtri</h2>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    Reset
                  </Button>
                  <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setShowFilters(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-4">
                {/* Pet Type Filter */}
                <div>
                  <Label htmlFor="pet-type" className="font-medium">Tipo di Animale</Label>
                  <Select value={petType} onValueChange={setPetType}>
                    <SelectTrigger id="pet-type" className="w-full mt-1">
                      <SelectValue placeholder="Seleziona un animale" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Tutti</SelectItem>
                      <SelectItem value="dog">Cane</SelectItem>
                      <SelectItem value="cat">Gatto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Sort By */}
                <div>
                  <Label htmlFor="sort-by" className="font-medium">Ordina per</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger id="sort-by" className="w-full mt-1">
                      <SelectValue placeholder="Ordina per" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="price_asc">Prezzo: Dal più basso</SelectItem>
                      <SelectItem value="price_desc">Prezzo: Dal più alto</SelectItem>
                      <SelectItem value="rating">Valutazione</SelectItem>
                      <SelectItem value="reviews">Recensioni</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Price Range */}
                <Accordion type="single" collapsible defaultValue="price">
                  <AccordionItem value="price">
                    <AccordionTrigger className="font-medium py-2">
                      Fascia di Prezzo
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="px-1 pt-2 pb-6">
                        <Slider 
                          defaultValue={[0, 100]} 
                          max={100} 
                          step={1} 
                          value={priceRange}
                          onValueChange={setPriceRange}
                        />
                        <div className="flex justify-between mt-2 text-sm">
                          <span>€{priceRange[0]}</span>
                          <span>€{priceRange[1]}</span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
                
                {/* Sources */}
                <Accordion type="single" collapsible defaultValue="sources">
                  <AccordionItem value="sources">
                    <AccordionTrigger className="font-medium py-2">
                      Rivenditori
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        {sources.map((source) => (
                          <div key={source.id} className="flex items-center space-x-2">
                            <Checkbox 
                              id={source.id} 
                              checked={source.checked}
                              onCheckedChange={() => toggleSource(source.id)}
                            />
                            <Label htmlFor={source.id}>{source.name}</Label>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
                
                {/* Brands */}
                {brands.length > 0 && (
                  <Accordion type="single" collapsible defaultValue="brands">
                    <AccordionItem value="brands">
                      <AccordionTrigger className="font-medium py-2">
                        Marche
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {brands.map((brand) => (
                            <div key={brand.id} className="flex items-center space-x-2">
                              <Checkbox 
                                id={brand.id} 
                                checked={selectedBrands.includes(brand.id)}
                                onCheckedChange={() => toggleBrand(brand.id)}
                              />
                              <Label htmlFor={brand.id}>{brand.name}</Label>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Results */}
        <div className="md:col-span-3">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center p-8">
              <p className="text-red-500">{error}</p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="text-center p-8">
              <h3 className="text-lg font-semibold mb-2">Nessun prodotto trovato</h3>
              <p className="text-muted-foreground mb-4">
                Prova a modificare i filtri o a cercare un altro prodotto
              </p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">
                  {filteredResults.length} prodotti trovati
                </p>
                <div className="hidden md:block">
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[200px]">
                      <SlidersHorizontal className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Ordina per" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="price_asc">Prezzo: Dal più basso</SelectItem>
                      <SelectItem value="price_desc">Prezzo: Dal più alto</SelectItem>
                      <SelectItem value="rating">Valutazione</SelectItem>
                      <SelectItem value="reviews">Recensioni</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredResults.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
} 