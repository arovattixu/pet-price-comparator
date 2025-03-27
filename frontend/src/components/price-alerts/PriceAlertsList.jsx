import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import Link from 'next/link';
import { ArrowTopRightOnSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

const PriceAlertsList = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // In una applicazione reale, l'userId verrebbe dal sistema di autenticazione
      const userId = localStorage.getItem('userId') || 'tempUser123';
      
      const response = await axios.get(`/api/price-alerts?userId=${userId}`);
      setAlerts(response.data.alerts || []);
    } catch (err) {
      console.error('Errore nel recupero degli avvisi:', err);
      setError('Non è stato possibile recuperare gli avvisi di prezzo');
      toast.error('Errore nel recupero degli avvisi');
    } finally {
      setLoading(false);
    }
  };

  const deleteAlert = async (alertId) => {
    if (!confirm('Sei sicuro di voler eliminare questo avviso?')) return;
    
    try {
      // In una applicazione reale, l'userId verrebbe dal sistema di autenticazione
      const userId = localStorage.getItem('userId') || 'tempUser123';
      
      await axios.delete(`/api/price-alerts/${alertId}`, {
        data: { userId }
      });
      
      // Aggiorna la lista rimuovendo l'avviso eliminato
      setAlerts(alerts.filter(alert => alert._id !== alertId));
      toast.success('Avviso eliminato con successo');
    } catch (error) {
      console.error('Errore nell\'eliminazione dell\'avviso:', error);
      toast.error('Errore nell\'eliminazione dell\'avviso');
    }
  };

  // Rendering condizionale per stati di caricamento e errore
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 my-4">
        <p className="text-red-700">{error}</p>
        <button 
          onClick={fetchAlerts}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Riprova
        </button>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md text-center">
        <p className="text-gray-600 mb-4">Non hai ancora creato avvisi di prezzo.</p>
        <p className="text-gray-600">
          Cerca un prodotto e crea un avviso per ricevere notifiche quando il prezzo cambia.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <h2 className="text-lg font-medium p-4 border-b">I tuoi avvisi di prezzo</h2>
      
      <ul className="divide-y divide-gray-200">
        {alerts.map((alert) => {
          // Determina il tipo di avviso
          let alertTypeText = '';
          if (alert.targetPrice) {
            alertTypeText = `Sotto ${alert.targetPrice.toFixed(2)}€`;
          } else if (alert.percentageChange) {
            alertTypeText = `Calo del ${alert.percentageChange}%`;
          } else if (alert.notifyOnAnyChange) {
            alertTypeText = 'Qualsiasi cambio';
          }
          
          // Formatta la data di creazione
          const createdAt = new Date(alert.createdAt).toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
          
          return (
            <li key={alert._id} className="p-4 hover:bg-gray-50">
              <div className="flex flex-col sm:flex-row justify-between">
                {/* Immagine e dettagli del prodotto */}
                <div className="flex items-start space-x-4 mb-4 sm:mb-0">
                  <div className="flex-shrink-0 w-16 h-16">
                    {alert.product?.imageUrl ? (
                      <img
                        src={alert.product.imageUrl}
                        alt={alert.product.title}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded">
                        <span className="text-gray-400 text-xs">No image</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <Link 
                      href={`/product/${alert.productId}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline flex items-center"
                    >
                      <span className="font-medium truncate">{alert.product?.title || 'Prodotto non disponibile'}</span>
                      <ArrowTopRightOnSquareIcon className="h-4 w-4 ml-1" />
                    </Link>
                    
                    {alert.product?.brand && (
                      <p className="text-sm text-gray-500 mt-1">
                        {alert.product.brand}
                      </p>
                    )}
                    
                    {alert.product?.variant ? (
                      <p className="text-sm text-gray-600 mt-1">
                        Variante: {alert.product.variant.description}
                      </p>
                    ) : null}
                    
                    <div className="flex flex-wrap mt-2">
                      {alertTypeText && (
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 mr-2 mb-1">
                          {alertTypeText}
                        </span>
                      )}
                      
                      {alert.source !== 'any' && (
                        <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800 mr-2 mb-1">
                          {alert.source === 'zooplus' ? 'Zooplus' : 'Arcaplanet'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Prezzo e azioni */}
                <div className="flex flex-col items-end">
                  <div className="flex items-baseline">
                    <span className="text-lg font-semibold text-gray-900">
                      {alert.currentPrice.toFixed(2)}€
                    </span>
                    <span className="ml-1 text-xs text-gray-500">Prezzo attuale</span>
                  </div>
                  
                  <div className="text-xs text-gray-500 mt-1">
                    Creato il {createdAt}
                  </div>
                  
                  <button
                    onClick={() => deleteAlert(alert._id)}
                    className="mt-3 inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <TrashIcon className="h-4 w-4 mr-1" />
                    Elimina
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default PriceAlertsList; 