'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import PriceAlertsList from '@/components/price-alerts/PriceAlertsList';
import { Toaster } from 'react-hot-toast';

const PriceAlertsPage = () => {
  // In un'applicazione reale, qui controlleremmo se l'utente è autenticato
  useEffect(() => {
    // Generiamo un userId temporaneo se non esiste
    if (!localStorage.getItem('userId')) {
      localStorage.setItem('userId', 'tempUser' + Math.floor(Math.random() * 1000));
    }
  }, []);

  return (
    <>
      <Toaster position="top-right" />
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link 
            href="/"
            className="inline-flex items-center text-blue-600 hover:text-blue-800"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Torna alla home
          </Link>
          
          <h1 className="text-2xl font-bold mt-4 mb-2">I tuoi avvisi di prezzo</h1>
          <p className="text-gray-600">
            Gestisci gli avvisi di prezzo per essere notificato quando i prezzi dei tuoi prodotti preferiti cambiano.
          </p>
        </div>
        
        <div className="grid grid-cols-1 gap-8">
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Come funzionano gli avvisi di prezzo</h2>
            
            <div className="space-y-4">
              <div className="flex">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  1
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium">Cerca un prodotto</h3>
                  <p className="mt-1 text-gray-500">
                    Trova il prodotto che desideri monitorare utilizzando la <Link href="/search" className="text-blue-600 hover:underline">ricerca</Link>.
                  </p>
                </div>
              </div>
              
              <div className="flex">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  2
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium">Crea un avviso di prezzo</h3>
                  <p className="mt-1 text-gray-500">
                    Nella pagina del prodotto, clicca sul pulsante "Crea avviso" e configura le tue preferenze.
                  </p>
                </div>
              </div>
              
              <div className="flex">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  3
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium">Ricevi notifiche</h3>
                  <p className="mt-1 text-gray-500">
                    Verrai notificato quando il prezzo del prodotto cambia in base alle tue preferenze.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <PriceAlertsList />
        </div>
      </div>
    </>
  );
};

export default PriceAlertsPage; 