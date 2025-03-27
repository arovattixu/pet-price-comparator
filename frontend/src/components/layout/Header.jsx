'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Moon, Sun, Search, ShoppingCart, Menu } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePetStore } from '@/store/index';

export default function Header() {
  const [searchTerm, setSearchTerm] = React.useState('');
  const { setTheme } = useTheme();
  const router = useRouter();
  const { selectedPet } = usePetStore();

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    
    const params = new URLSearchParams();
    params.set('query', searchTerm);
    if (selectedPet?.type) {
      params.set('petType', selectedPet.type);
    }
    
    router.push(`/search?${params.toString()}`);
  };

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="text-2xl font-bold">
              PetPriceCompare
            </Link>
            <nav className="hidden md:flex space-x-4">
              <Link href="/search?category=cibo_secco_cani&petType=dog" className="hover:underline">
                Cibo Cani
              </Link>
              <Link href="/search?category=cibo_umido_gatti&petType=cat" className="hover:underline">
                Cibo Gatti
              </Link>
              <Link href="/compare" className="hover:underline">
                Confronta
              </Link>
              <Link href="/price-alerts" className="hover:underline">
                Avvisi Prezzi
              </Link>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <form onSubmit={handleSearch} className="hidden md:flex">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Cerca prodotti..."
                  className="w-64 pr-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button type="submit" className="absolute right-2 top-1/2 transform -translate-y-1/2">
                  <Search className="h-4 w-4 text-gray-500" />
                </button>
              </div>
            </form>

            {selectedPet && (
              <div className="hidden md:flex items-center space-x-1">
                <span className="text-sm text-muted-foreground">
                  {selectedPet.type === 'dog' ? '🐕' : '🐈'} 
                  {selectedPet.name || (selectedPet.type === 'dog' ? 'Cane' : 'Gatto')}
                </span>
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">Toggle theme</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  System
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="icon" className="md:hidden">
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
} 