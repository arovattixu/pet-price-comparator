'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { priceService } from '@/services/api';

export default function PriceHistory({ productId, variantId, title, initialData = null }) {
  const [priceHistory, setPriceHistory] = useState(initialData || []);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('month'); // week, month, year
  
  useEffect(() => {
    const fetchPriceHistory = async () => {
      if (!productId || !variantId) return;
      
      setLoading(true);
      try {
        const data = await priceService.getPriceHistory(productId, variantId);
        setPriceHistory(data);
      } catch (err) {
        console.error('Error fetching price history:', err);
        setError('Impossibile caricare lo storico prezzi');
      } finally {
        setLoading(false);
      }
    };
    
    if (!initialData && productId && variantId) {
      fetchPriceHistory();
    }
  }, [productId, variantId, initialData]);
  
  // Formatta il prezzo in Euro
  const formatPrice = (price) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  };
  
  const filterDataByTimeRange = () => {
    if (!priceHistory || priceHistory.length === 0) return [];
    
    const now = new Date();
    let cutoffDate;
    
    switch (timeRange) {
      case 'week':
        cutoffDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        cutoffDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        cutoffDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        cutoffDate = new Date(now.setMonth(now.getMonth() - 1)); // Default to month
    }
    
    return priceHistory
      .filter(point => new Date(point.recordedAt) >= cutoffDate)
      .map(point => ({
        date: new Date(point.recordedAt).toLocaleDateString('it-IT', {
          day: '2-digit',
          month: 'short',
        }),
        price: typeof point.price?.amount === 'number' 
          ? point.price.amount 
          : parseFloat(point.price?.amount || 0),
        discounted: point.price?.discounted || false
      }));
  };
  
  const chartData = filterDataByTimeRange();
  
  // Calcola il prezzo minimo e massimo per i display
  const minPrice = chartData.length > 0 ? Math.min(...chartData.map(d => d.price)) : 0;
  const maxPrice = chartData.length > 0 ? Math.max(...chartData.map(d => d.price)) : 0;
  const currentPrice = chartData.length > 0 ? chartData[chartData.length-1].price : 0;
  
  // Calcola variazione percentuale dal primo all'ultimo prezzo
  const priceChange = chartData.length > 1 
    ? ((chartData[chartData.length-1].price - chartData[0].price) / chartData[0].price) * 100
    : 0;
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Storico Prezzi</CardTitle>
          <CardDescription>{title || 'Andamento del prezzo nel tempo'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
            <Skeleton className="h-72 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Storico Prezzi</CardTitle>
          <CardDescription>{title || 'Andamento del prezzo nel tempo'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center p-4">
            <p className="text-red-500">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!chartData || chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Storico Prezzi</CardTitle>
          <CardDescription>{title || 'Andamento del prezzo nel tempo'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center p-4">
            <p className="text-muted-foreground">Nessun dato storico disponibile</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <CardTitle>Storico Prezzi</CardTitle>
          <CardDescription>
            {title || 'Andamento del prezzo nel tempo'}
          </CardDescription>
        </div>
        <Tabs value={timeRange} onValueChange={setTimeRange}>
          <TabsList>
            <TabsTrigger value="week">7g</TabsTrigger>
            <TabsTrigger value="month">30g</TabsTrigger>
            <TabsTrigger value="year">1a</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded">
            <div className="text-sm text-slate-500 dark:text-slate-400">Prezzo minimo</div>
            <div className="text-xl font-bold">{formatPrice(minPrice)}</div>
          </div>
          <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded">
            <div className="text-sm text-slate-500 dark:text-slate-400">Prezzo attuale</div>
            <div className="text-xl font-bold">{formatPrice(currentPrice)}</div>
          </div>
          <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded">
            <div className="text-sm text-slate-500 dark:text-slate-400">Variazione</div>
            <div className={`text-xl font-bold ${priceChange > 0 ? 'text-red-500' : priceChange < 0 ? 'text-green-500' : ''}`}>
              {priceChange > 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </div>
          </div>
        </div>
        
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date"
                padding={{ left: 10, right: 10 }}
              />
              <YAxis 
                domain={[
                  Math.max(0, minPrice * 0.9), // Min value (no less than 0)
                  maxPrice * 1.1 // Max value + 10%
                ]} 
                tickFormatter={formatPrice}
              />
              <Tooltip formatter={(value) => formatPrice(value)} />
              <Legend />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#3b82f6"
                activeDot={{ r: 8 }}
                strokeWidth={2}
                name="Prezzo"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
} 