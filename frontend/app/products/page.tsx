"use client";

import { useState, useEffect } from "react";
import { productApi } from "@/lib/api";
import { useSearchStore, SearchFilters } from "@/lib/stores/searchStore";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductCard } from "@/components/ui/product-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Search, Filter } from "lucide-react";

export default function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentFilters, setFilter, clearFilters, addToHistory } = useSearchStore();
  
  // Local search state
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  // Initialize filters from URL params
  useEffect(() => {
    const query = searchParams.get('query');
    const category = searchParams.get('category');
    const brand = searchParams.get('brand');
    const petType = searchParams.get('petType');
    
    if (query) setFilter('query', query);
    if (category) setFilter('category', category);
    if (brand) setFilter('brand', brand);
    if (petType) setFilter('petType', petType);
    
    // Fetch categories and brands for filters
    Promise.all([
      productApi.getCategories(),
      productApi.getBrands()
    ])
    .then(([categoriesResponse, brandsResponse]) => {
      console.log("Categories response:", categoriesResponse);
      console.log("Brands response:", brandsResponse);
      
      // Estrai i dati dalla risposta API
      let categoriesList: string[] = [];
      let brandsList: string[] = [];
      
      // Gestisci i diversi formati possibili
      if (categoriesResponse.data) {
        categoriesList = categoriesResponse.data;
      } else if (Array.isArray(categoriesResponse)) {
        categoriesList = categoriesResponse;
      }
      
      if (brandsResponse.data) {
        brandsList = brandsResponse.data;
      } else if (Array.isArray(brandsResponse)) {
        brandsList = brandsResponse;
      }
      
      console.log("Categorie elaborate:", categoriesList);
      console.log("Brand elaborati:", brandsList);
      
      setCategories(categoriesList);
      setBrands(brandsList);
    })
    .catch(err => console.error("Failed to load filter options:", err));
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Fetch products when filters change
  useEffect(() => {
    setLoading(true);
    
    productApi.search(currentFilters)
      .then(response => {
        // Adatta il codice per gestire il formato di risposta effettivo dell'API
        console.log("API search response nella pagina:", response);
        
        // Verifica i diversi formati possibili della risposta
        let productsData = [];
        
        if (response.data) {
          productsData = response.data;
        } else if (response.products) {
          productsData = response.products;
        } else if (Array.isArray(response)) {
          productsData = response;
        } else if (response.success && response.data) {
          productsData = response.data;
        } else {
          console.error("Formato risposta API non riconosciuto:", response);
          productsData = [];
        }
        
        console.log("Prodotti elaborati:", productsData);
        setProducts(productsData);
        setLoading(false);
        
        // Add to search history
        if (currentFilters.query || currentFilters.category || 
            currentFilters.brand || currentFilters.petType) {
          addToHistory(currentFilters);
        }
      })
      .catch(err => {
        console.error("Failed to search products:", err);
        setLoading(false);
        setProducts([]);
      });
      
    // Update URL with search parameters
    updateUrl(currentFilters);
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFilters]);
  
  // Update URL when filters change
  const updateUrl = (filters: SearchFilters) => {
    const params = new URLSearchParams();
    
    if (filters.query) params.set('query', filters.query);
    if (filters.category) params.set('category', filters.category);
    if (filters.brand) params.set('brand', filters.brand);
    if (filters.petType) params.set('petType', filters.petType);
    
    const queryString = params.toString();
    const url = queryString ? `/products?${queryString}` : '/products';
    router.push(url, { scroll: false });
  };
  
  // Handle search form submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const query = formData.get('query') as string;
    
    if (query) {
      setFilter('query', query);
    }
  };
  
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Products</h1>
      
      {/* Search form */}
      <div className="mb-6">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input 
            name="query" 
            placeholder="Search products..." 
            className="flex-1"
            defaultValue={currentFilters.query || ''}
          />
          <Button type="submit">
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
          <Button 
            type="button" 
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </form>
      </div>
      
      {/* Filter panel */}
      {showFilters && (
        <div className="mb-6 p-4 border rounded-lg bg-muted/30">
          <h3 className="text-lg font-medium mb-4">Filters</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category filter */}
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <Select 
                value={currentFilters.category || ''} 
                onValueChange={(value) => setFilter('category', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Brand filter */}
            <div>
              <label className="block text-sm font-medium mb-1">Brand</label>
              <Select 
                value={currentFilters.brand || ''} 
                onValueChange={(value) => setFilter('brand', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Brands</SelectItem>
                  {brands.map(brand => (
                    <SelectItem key={brand} value={brand}>
                      {brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Pet type filter */}
            <div>
              <label className="block text-sm font-medium mb-1">Pet Type</label>
              <Select 
                value={currentFilters.petType || ''} 
                onValueChange={(value) => setFilter('petType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select pet type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Pets</SelectItem>
                  <SelectItem value="cane">Dog</SelectItem>
                  <SelectItem value="gatto">Cat</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex justify-end mt-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => clearFilters()}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      )}
      
      {/* Results count and sort options */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        <p className="text-sm text-muted-foreground">
          {loading ? 'Loading...' : `${products.length} products found`}
        </p>
        
        <Select
          value={currentFilters.sortBy || 'relevance'}
          onValueChange={(value) => setFilter('sortBy', value as any)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">Relevance</SelectItem>
            <SelectItem value="price_asc">Price: Low to High</SelectItem>
            <SelectItem value="price_desc">Price: High to Low</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <Separator className="my-4" />
      
      {/* Product grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-[350px] rounded-lg bg-muted/30 animate-pulse"
            />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium">No products found</h3>
          <p className="text-muted-foreground mt-1">
            Try adjusting your search or filter criteria
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map(product => (
            <ProductCard
              key={product._id || product.id}
              product={product}
              onClick={() => router.push(`/products/${product._id || product.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
} 