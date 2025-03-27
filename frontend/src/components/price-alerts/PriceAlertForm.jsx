import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const PriceAlertForm = ({ product, variant, onSuccess }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    alertType: 'targetPrice', // targetPrice, percentageChange, anyChange
    targetPrice: '',
    percentageChange: '10', // Default 10%
    notifyOnAnyChange: false,
    source: 'any' // any, zooplus, arcaplanet
  });

  // Estraggo informazioni sul prodotto e prezzo attuale
  const currentPrice = variant 
    ? variant.currentPrice?.amount
    : product.variants?.length 
      ? Math.min(...product.variants.map(v => v.currentPrice?.amount || Infinity))
      : 0;

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAlertTypeChange = (e) => {
    const type = e.target.value;
    setFormData(prev => ({
      ...prev,
      alertType: type,
      notifyOnAnyChange: type === 'anyChange'
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // In una applicazione reale, l'userId verrebbe dal sistema di autenticazione
      const userId = localStorage.getItem('userId') || 'tempUser123';
      
      // Prepara i dati per l'API
      const apiData = {
        productId: product._id,
        variantId: variant?.variantId || null,
        userId,
        source: formData.source
      };

      // Aggiungi campi specifici in base al tipo di avviso
      if (formData.alertType === 'targetPrice') {
        apiData.targetPrice = parseFloat(formData.targetPrice);
      } else if (formData.alertType === 'percentageChange') {
        apiData.percentageChange = parseFloat(formData.percentageChange);
      } else if (formData.alertType === 'anyChange') {
        apiData.notifyOnAnyChange = true;
      }

      const response = await axios.post('/api/price-alerts', apiData);
      
      toast.success('Avviso di prezzo creato con successo!');
      if (onSuccess) onSuccess(response.data.alert);
      
      // Reset del form
      setFormData({
        alertType: 'targetPrice',
        targetPrice: '',
        percentageChange: '10',
        notifyOnAnyChange: false,
        source: 'any'
      });
    } catch (error) {
      console.error('Errore nella creazione dell\'avviso:', error);
      toast.error(error.response?.data?.error || 'Errore nella creazione dell\'avviso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-medium mb-4">Crea un avviso di prezzo</h3>
      
      <form onSubmit={handleSubmit}>
        {/* Tipo di avviso */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo di avviso
          </label>
          <div className="flex flex-col space-y-2">
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="alertType"
                value="targetPrice"
                checked={formData.alertType === 'targetPrice'}
                onChange={handleAlertTypeChange}
                className="h-4 w-4 text-blue-600"
              />
              <span className="ml-2">Avvisami quando il prezzo scende sotto una soglia</span>
            </label>
            
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="alertType"
                value="percentageChange"
                checked={formData.alertType === 'percentageChange'}
                onChange={handleAlertTypeChange}
                className="h-4 w-4 text-blue-600"
              />
              <span className="ml-2">Avvisami quando il prezzo cala di una percentuale</span>
            </label>
            
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="alertType"
                value="anyChange"
                checked={formData.alertType === 'anyChange'}
                onChange={handleAlertTypeChange}
                className="h-4 w-4 text-blue-600"
              />
              <span className="ml-2">Avvisami per qualsiasi cambiamento di prezzo</span>
            </label>
          </div>
        </div>
        
        {/* Campi specifici in base al tipo di avviso */}
        {formData.alertType === 'targetPrice' && (
          <div className="mb-4">
            <label htmlFor="targetPrice" className="block text-sm font-medium text-gray-700 mb-1">
              Prezzo target (€)
            </label>
            <div className="flex items-center">
              <input
                type="number"
                id="targetPrice"
                name="targetPrice"
                min="0.01"
                step="0.01"
                required
                value={formData.targetPrice}
                onChange={handleInputChange}
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                placeholder="Inserisci il prezzo target"
              />
            </div>
            {currentPrice > 0 && (
              <p className="mt-1 text-sm text-gray-500">
                Prezzo attuale: {currentPrice.toFixed(2)}€
              </p>
            )}
          </div>
        )}
        
        {formData.alertType === 'percentageChange' && (
          <div className="mb-4">
            <label htmlFor="percentageChange" className="block text-sm font-medium text-gray-700 mb-1">
              Calo di prezzo (%)
            </label>
            <div className="flex items-center">
              <input
                type="number"
                id="percentageChange"
                name="percentageChange"
                min="1"
                max="99"
                required
                value={formData.percentageChange}
                onChange={handleInputChange}
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                placeholder="Percentuale di riduzione"
              />
              <span className="ml-2">%</span>
            </div>
            {currentPrice > 0 && (
              <p className="mt-1 text-sm text-gray-500">
                Prezzo attuale: {currentPrice.toFixed(2)}€ | 
                Con calo del {formData.percentageChange}%: {(currentPrice * (1 - parseInt(formData.percentageChange) / 100)).toFixed(2)}€
              </p>
            )}
          </div>
        )}
        
        {/* Negozio */}
        <div className="mb-4">
          <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-1">
            Negozio
          </label>
          <select
            id="source"
            name="source"
            value={formData.source}
            onChange={handleInputChange}
            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
          >
            <option value="any">Qualsiasi negozio</option>
            <option value="zooplus">Solo Zooplus</option>
            <option value="arcaplanet">Solo Arcaplanet</option>
          </select>
        </div>
        
        {/* Submit button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Creazione in corso...' : 'Crea avviso'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PriceAlertForm; 