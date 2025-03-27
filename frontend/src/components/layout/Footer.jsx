import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-bold mb-4">PetPriceCompare</h3>
            <p className="text-sm text-muted-foreground">
              Confronta i prezzi dei prodotti per animali domestici dai principali rivenditori online.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Categorie</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/search?category=cibo_secco_cani&petType=dog" className="hover:underline">Cibo Secco Cani</Link></li>
              <li><Link href="/search?category=cibo_umido_cani&petType=dog" className="hover:underline">Cibo Umido Cani</Link></li>
              <li><Link href="/search?category=cibo_secco_gatti&petType=cat" className="hover:underline">Cibo Secco Gatti</Link></li>
              <li><Link href="/search?category=cibo_umido_gatti&petType=cat" className="hover:underline">Cibo Umido Gatti</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Link Utili</h4>
            <ul className="space-y-2 text-sm">
              {/* Temporaneamente disabilitati fino a quando le pagine non saranno pronte */}
              {/* <li><Link href="/about" className="hover:underline">Chi Siamo</Link></li>
              <li><Link href="/contact" className="hover:underline">Contatti</Link></li>
              <li><Link href="/privacy" className="hover:underline">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:underline">Termini di Servizio</Link></li> */}
              <li><Link href="/" className="hover:underline">Home</Link></li>
              <li><Link href="/search" className="hover:underline">Ricerca</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Rivenditori</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="https://www.zooplus.it" target="_blank" rel="noopener noreferrer" className="hover:underline">Zooplus</a></li>
              <li><a href="https://www.arcaplanet.it" target="_blank" rel="noopener noreferrer" className="hover:underline">Arcaplanet</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-4 border-t text-sm text-center text-muted-foreground">
          © {new Date().getFullYear()} PetPriceCompare. Tutti i diritti riservati.
        </div>
      </div>
    </footer>
  );
} 