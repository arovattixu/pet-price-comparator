'use client';

import React from 'react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Trash2, ExternalLink, Star } from 'lucide-react';
import { useCompareStore } from '@/store';

export default function ComparisonTable() {
  const { compareList, removeFromCompare, clearCompare } = useCompareStore();
  
  if (!compareList || compareList.length === 0) {
    return (
      <div className="text-center p-8">
        <h3 className="text-lg font-semibold mb-2">Nessun prodotto da confrontare</h3>
        <p className="text-muted-foreground mb-4">
          Aggiungi prodotti al confronto durante la navigazione
        </p>
        <Button variant="outline" onClick={() => window.location.href = '/search'}>
          Cerca Prodotti
        </Button>
      </div>
    );
  }
  
  // Ottenere tutte le caratteristiche uniche
  const allFeatures = new Set();
  compareList.forEach(product => {
    if (product.features) {
      Object.keys(product.features).forEach(feature => allFeatures.add(feature));
    }
  });
  
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex justify-end mb-4">
        <Button variant="outline" size="sm" onClick={clearCompare}>
          <Trash2 className="h-4 w-4 mr-2" />
          Cancella tutto
        </Button>
      </div>
      
      <Table>
        <TableCaption>Confronto prodotti per animali domestici</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Caratteristiche</TableHead>
            {compareList.map(product => (
              <TableHead key={product.id} className="min-w-[200px]">
                <div className="flex justify-between items-start">
                  <span>{product.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFromCompare(product.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Immagine */}
          <TableRow>
            <TableCell className="font-medium">Immagine</TableCell>
            {compareList.map(product => (
              <TableCell key={product.id}>
                <div className="relative h-32 w-32 mx-auto">
                  <Image
                    src={product.imageUrl || '/images/placeholder-product.png'}
                    alt={product.title}
                    fill
                    className="object-contain"
                  />
                </div>
              </TableCell>
            ))}
          </TableRow>
          
          {/* Prezzo */}
          <TableRow>
            <TableCell className="font-medium">Prezzo</TableCell>
            {compareList.map(product => {
              const minPrice = product.variants && product.variants.length > 0
                ? Math.min(...product.variants.map(v => v.price || Infinity))
                : (product.price?.current || null);
                
              // Verifico se questo è il prezzo migliore tra tutti i prodotti confrontati
              const isLowestPrice = minPrice && Math.min(
                ...compareList
                  .map(p => p.variants && p.variants.length > 0
                    ? Math.min(...p.variants.map(v => v.price || Infinity))
                    : (p.price?.current || Infinity)
                  )
              ) === minPrice;
              
              return (
                <TableCell key={product.id}>
                  {minPrice ? (
                    <div className={`font-bold ${isLowestPrice ? 'text-green-600' : ''}`}>
                      € {minPrice.toFixed(2)}
                      {isLowestPrice && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Miglior prezzo
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">Non disponibile</div>
                  )}
                </TableCell>
              );
            })}
          </TableRow>
          
          {/* Risparmio potenziale */}
          {compareList.length > 1 && (
            <TableRow>
              <TableCell className="font-medium">Risparmio potenziale</TableCell>
              <TableCell colSpan={compareList.length}>
                {(() => {
                  // Calcola prezzo minimo e massimo
                  const prices = compareList
                    .map(p => p.variants && p.variants.length > 0
                      ? Math.min(...p.variants.map(v => v.price || Infinity))
                      : (p.price?.current || null)
                    )
                    .filter(price => price !== null && price !== Infinity);
                    
                  if (prices.length < 2) return 'Confronto non disponibile';
                  
                  const minPrice = Math.min(...prices);
                  const maxPrice = Math.max(...prices);
                  const savingAmount = maxPrice - minPrice;
                  const savingPercentage = ((savingAmount / maxPrice) * 100).toFixed(1);
                  
                  return (
                    <div className="bg-amber-50 border border-amber-200 rounded p-2 text-center">
                      <span className="font-bold text-amber-800">
                        Risparmio di € {savingAmount.toFixed(2)} ({savingPercentage}%)
                      </span>
                      <p className="text-xs text-amber-700 mt-1">
                        Confrontando il prezzo più basso con il più alto tra questi prodotti
                      </p>
                    </div>
                  );
                })()}
              </TableCell>
            </TableRow>
          )}
          
          {/* Fonte */}
          <TableRow>
            <TableCell className="font-medium">Rivenditore</TableCell>
            {compareList.map(product => (
              <TableCell key={product.id}>
                <Badge variant="outline">
                  {product.source === 'zooplus' ? 'Zooplus' : 'Arcaplanet'}
                </Badge>
              </TableCell>
            ))}
          </TableRow>
          
          {/* Valutazione */}
          <TableRow>
            <TableCell className="font-medium">Valutazione</TableCell>
            {compareList.map(product => (
              <TableCell key={product.id}>
                {product.rating ? (
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < product.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                        }`}
                      />
                    ))}
                    {product.reviewCount && (
                      <span className="text-sm ml-1 text-muted-foreground">
                        ({product.reviewCount})
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-muted-foreground">Nessuna valutazione</div>
                )}
              </TableCell>
            ))}
          </TableRow>
          
          {/* Descrizione */}
          <TableRow>
            <TableCell className="font-medium">Descrizione</TableCell>
            {compareList.map(product => (
              <TableCell key={product.id}>
                <div className="max-h-24 overflow-y-auto text-sm">
                  {product.description || 'Nessuna descrizione disponibile'}
                </div>
              </TableCell>
            ))}
          </TableRow>
          
          {/* Varianti */}
          <TableRow>
            <TableCell className="font-medium">Varianti</TableCell>
            {compareList.map(product => (
              <TableCell key={product.id}>
                {product.variants && product.variants.length > 0 ? (
                  <div className="text-sm">
                    {product.variants.length} varianti disponibili
                  </div>
                ) : (
                  <div className="text-muted-foreground">Nessuna variante</div>
                )}
              </TableCell>
            ))}
          </TableRow>
          
          {/* Link al prodotto */}
          <TableRow>
            <TableCell className="font-medium">Link</TableCell>
            {compareList.map(product => (
              <TableCell key={product.id}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(product.url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Visita
                </Button>
              </TableCell>
            ))}
          </TableRow>
          
          {/* Caratteristiche aggiuntive */}
          {Array.from(allFeatures).map(feature => (
            <TableRow key={feature}>
              <TableCell className="font-medium">
                {feature.charAt(0).toUpperCase() + feature.slice(1)}
              </TableCell>
              {compareList.map(product => (
                <TableCell key={product.id}>
                  {product.features && product.features[feature] ? 
                    product.features[feature] : 
                    <span className="text-muted-foreground">N/D</span>
                  }
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 