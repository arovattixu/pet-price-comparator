'use client';

import React, { useState } from 'react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Cat, Dog } from "lucide-react";
import { usePetStore } from '@/store/index';

const PetSelector = ({ onPetSelected }) => {
  const { setSelectedPet } = usePetStore();
  const [petType, setPetType] = useState("");
  const [petName, setPetName] = useState("");
  const [petSize, setPetSize] = useState("");
  const [petAge, setPetAge] = useState("");
  
  const handleSubmit = () => {
    const petInfo = {
      type: petType,
      name: petName,
      size: petSize,
      age: petAge
    };
    
    // Salva nello store Zustand per persistenza
    setSelectedPet(petInfo);
    
    // Passa i dati al componente genitore tramite callback
    onPetSelected(petInfo);
  };
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Il tuo Amico a 4 Zampe</CardTitle>
        <CardDescription>
          Personalizza i risultati in base al tuo animale domestico
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 justify-center">
          <Button 
            variant={petType === "dog" ? "default" : "outline"}
            className="flex flex-col items-center p-6" 
            onClick={() => setPetType("dog")}
          >
            <Dog size={32} />
            <span className="mt-2">Cane</span>
          </Button>
          <Button 
            variant={petType === "cat" ? "default" : "outline"}
            className="flex flex-col items-center p-6" 
            onClick={() => setPetType("cat")}
          >
            <Cat size={32} />
            <span className="mt-2">Gatto</span>
          </Button>
        </div>
        
        {petType && (
          <>
            <div className="space-y-2">
              <label htmlFor="pet-name" className="text-sm font-medium">
                Nome (opzionale)
              </label>
              <Input 
                id="pet-name"
                placeholder={petType === "dog" ? "Nome del tuo cane" : "Nome del tuo gatto"}
                value={petName}
                onChange={(e) => setPetName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="pet-size" className="text-sm font-medium">
                Taglia
              </label>
              <Select value={petSize} onValueChange={setPetSize}>
                <SelectTrigger id="pet-size">
                  <SelectValue placeholder="Seleziona la taglia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xs">Molto piccola (&lt; 5kg)</SelectItem>
                  <SelectItem value="small">Piccola (5-10kg)</SelectItem>
                  <SelectItem value="medium">Media (10-25kg)</SelectItem>
                  <SelectItem value="large">Grande (25-45kg)</SelectItem>
                  <SelectItem value="xl">Molto grande (&gt; 45kg)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="pet-age" className="text-sm font-medium">
                Età
              </label>
              <Select value={petAge} onValueChange={setPetAge}>
                <SelectTrigger id="pet-age">
                  <SelectValue placeholder="Seleziona l'età" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="puppy">Cucciolo (&lt; 1 anno)</SelectItem>
                  <SelectItem value="young">Giovane (1-3 anni)</SelectItem>
                  <SelectItem value="adult">Adulto (3-7 anni)</SelectItem>
                  <SelectItem value="senior">Anziano (&gt; 7 anni)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleSubmit} 
          className="w-full"
          disabled={!petType || !petSize || !petAge}
        >
          Trova Prodotti Perfetti
        </Button>
      </CardFooter>
    </Card>
  );
};

export default PetSelector; 