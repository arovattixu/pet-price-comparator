"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { productApi } from "@/lib/api";
import { useSearchStore } from "@/lib/stores/searchStore";
import { Search } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { addToHistory } = useSearchStore();
  
  // Handle search form submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (query.trim()) {
      addToHistory({ query });
      // Vai direttamente alla pagina dei risultati di ricerca
      router.push(`/products?query=${encodeURIComponent(query)}`);
    }
  };
  
  return (
    <main className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)]">
      <div className="w-full max-w-2xl px-4 space-y-12">
        {/* Logo or title */}
        <div className="flex flex-col items-center space-y-2">
          <h1 className="text-4xl font-bold">Pet Price Comparator</h1>
          <p className="text-lg text-muted-foreground text-center">
            Find the best deals on pet products across multiple stores
          </p>
        </div>
        
        {/* Search form */}
        <form onSubmit={handleSearch} className="w-full">
          <div className="relative">
            <Input
              type="text"
              placeholder="Search products, brands, pet food..."
              className="w-full h-14 pl-4 pr-12 text-lg rounded-full border-2 shadow-sm focus-visible:ring-offset-0"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button 
              type="submit" 
              size="icon" 
              className="absolute right-1.5 top-1.5 rounded-full w-11 h-11"
            >
              <Search className="h-5 w-5" />
            </Button>
          </div>
        </form>
        
        {/* Quick navigation buttons */}
        <div className="flex flex-wrap justify-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => router.push('/products?petType=cane')}
          >
            Dog Products
          </Button>
          <Button 
            variant="outline" 
            onClick={() => router.push('/products?petType=gatto')}
          >
            Cat Products
          </Button>
          <Button 
            variant="outline" 
            onClick={() => router.push('/products?category=cibo')}
          >
            Pet Food
          </Button>
          <Button 
            variant="outline" 
            onClick={() => router.push('/deals/best')}
          >
            Best Deals
          </Button>
        </div>
      </div>
    </main>
  );
}
