'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import ComparisonTable from '@/components/product/ComparisonTable';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function ComparePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/search" className="inline-flex items-center text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Torna alla ricerca
        </Link>
        <h1 className="text-3xl font-bold mt-2">Confronta Prodotti</h1>
        <p className="text-muted-foreground mt-1">
          Confronta le caratteristiche e i prezzi dei prodotti selezionati
        </p>
      </div>
      
      <ComparisonTable />
    </div>
  );
} 