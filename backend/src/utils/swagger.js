const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const logger = require('./logger');
const packageJson = require('../../package.json');

// Opzioni di configurazione Swagger
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Pet Price Comparator API',
      version: packageJson.version,
      description: 'API per il comparatore di prezzi di prodotti per animali domestici',
      contact: {
        name: 'Pet Price Comparator Team',
        url: 'https://www.petpricecomparator.it',
        email: 'info@petpricecomparator.it'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: '/api',
        description: 'API Server'
      }
    ],
    tags: [
      {
        name: 'Prodotti',
        description: 'Operazioni sui prodotti'
      },
      {
        name: 'Prezzi',
        description: 'Operazioni sui prezzi'
      },
      {
        name: 'Confronto',
        description: 'Confronto tra prodotti e prezzi'
      },
      {
        name: 'Offerte',
        description: 'Migliori offerte e risparmio'
      },
      {
        name: 'Trend',
        description: 'Analisi degli andamenti dei prezzi'
      },
      {
        name: 'Notifiche',
        description: 'Notifiche e alert sui prezzi'
      }
    ],
    components: {
      schemas: {
        Product: {
          type: 'object',
          required: ['name', 'source', 'sourceId'],
          properties: {
            _id: {
              type: 'string',
              description: 'ID univoco del prodotto'
            },
            name: {
              type: 'string',
              description: 'Nome del prodotto'
            },
            description: {
              type: 'string',
              description: 'Descrizione del prodotto'
            },
            brand: {
              type: 'string',
              description: 'Marca del prodotto'
            },
            category: {
              type: 'string',
              description: 'Categoria del prodotto'
            },
            imageUrl: {
              type: 'string',
              description: 'URL dell\'immagine del prodotto'
            },
            source: {
              type: 'string',
              enum: ['zooplus', 'arcaplanet'],
              description: 'Fonte del prodotto'
            },
            sourceId: {
              type: 'string',
              description: 'ID del prodotto nella fonte originale'
            },
            petType: {
              type: 'string',
              enum: ['cane', 'gatto'],
              description: 'Tipo di animale a cui è destinato il prodotto'
            },
            prices: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  store: {
                    type: 'string',
                    enum: ['zooplus', 'arcaplanet'],
                    description: 'Nome del negozio'
                  },
                  price: {
                    type: 'number',
                    description: 'Prezzo attuale'
                  },
                  currency: {
                    type: 'string',
                    description: 'Valuta del prezzo',
                    default: 'EUR'
                  },
                  url: {
                    type: 'string',
                    description: 'URL della pagina del prodotto'
                  },
                  lastUpdated: {
                    type: 'string',
                    format: 'date-time',
                    description: 'Data di ultimo aggiornamento del prezzo'
                  },
                  inStock: {
                    type: 'boolean',
                    description: 'Indica se il prodotto è disponibile',
                    default: true
                  }
                }
              }
            },
            weight: {
              type: 'string',
              description: 'Peso del prodotto'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Data di creazione'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Data di ultimo aggiornamento'
            }
          }
        },
        PricePoint: {
          type: 'object',
          properties: {
            productId: {
              type: 'string',
              description: 'ID del prodotto'
            },
            variantId: {
              type: 'string',
              description: 'ID della variante del prodotto'
            },
            source: {
              type: 'string',
              enum: ['zooplus', 'arcaplanet'],
              description: 'Fonte del prezzo'
            },
            price: {
              type: 'object',
              properties: {
                amount: {
                  type: 'number',
                  description: 'Importo del prezzo'
                },
                currency: {
                  type: 'string',
                  description: 'Valuta',
                  default: 'EUR'
                },
                unitPrice: {
                  type: 'string',
                  description: 'Prezzo unitario (es. €/kg)'
                },
                discounted: {
                  type: 'boolean',
                  description: 'Indica se il prezzo è scontato'
                },
                discountAmount: {
                  type: 'string',
                  description: 'Importo dello sconto'
                }
              }
            },
            recordedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Data di registrazione del prezzo'
            }
          }
        },
        SimilarProduct: {
          type: 'object',
          properties: {
            productId: {
              type: 'string',
              description: 'ID del prodotto di riferimento'
            },
            similarProductId: {
              type: 'string',
              description: 'ID del prodotto simile'
            },
            similarity: {
              type: 'number',
              description: 'Punteggio di similarità (0-1)'
            },
            priceDifference: {
              type: 'number',
              description: 'Differenza di prezzo tra i prodotti'
            },
            priceRatio: {
              type: 'number',
              description: 'Rapporto tra prezzo più alto e più basso'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Data di ultimo aggiornamento'
            }
          }
        },
        PriceAlert: {
          type: 'object',
          properties: {
            productId: {
              type: 'string',
              description: 'ID del prodotto'
            },
            email: {
              type: 'string',
              description: 'Email dell\'utente'
            },
            targetPrice: {
              type: 'number',
              description: 'Prezzo target per la notifica'
            },
            active: {
              type: 'boolean',
              description: 'Stato dell\'alert',
              default: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Data di creazione'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'Messaggio di errore'
                },
                code: {
                  type: 'string',
                  description: 'Codice di errore'
                }
              }
            }
          }
        }
      },
      responses: {
        BadRequest: {
          description: 'Richiesta non valida',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: {
                  message: 'Parametri non validi',
                  code: 'INVALID_PARAMETERS'
                }
              }
            }
          }
        },
        NotFound: {
          description: 'Risorsa non trovata',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: {
                  message: 'Risorsa non trovata',
                  code: 'RESOURCE_NOT_FOUND'
                }
              }
            }
          }
        },
        ServerError: {
          description: 'Errore del server',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: {
                  message: 'Errore interno del server',
                  code: 'SERVER_ERROR'
                }
              }
            }
          }
        }
      },
      parameters: {
        productId: {
          name: 'productId',
          in: 'path',
          description: 'ID del prodotto',
          required: true,
          schema: {
            type: 'string'
          }
        },
        limit: {
          name: 'limit',
          in: 'query',
          description: 'Numero massimo di risultati',
          schema: {
            type: 'integer',
            default: 10
          }
        },
        page: {
          name: 'page',
          in: 'query',
          description: 'Pagina dei risultati',
          schema: {
            type: 'integer',
            default: 1
          }
        },
        category: {
          name: 'category',
          in: 'query',
          description: 'Categoria del prodotto',
          schema: {
            type: 'string'
          }
        },
        petType: {
          name: 'petType',
          in: 'query',
          description: 'Tipo di animale',
          schema: {
            type: 'string',
            enum: ['cane', 'gatto']
          }
        },
        period: {
          name: 'period',
          in: 'query',
          description: 'Periodo di tempo per i dati',
          schema: {
            type: 'string',
            enum: ['7days', '30days', '90days', '1year', 'all'],
            default: '30days'
          }
        }
      }
    }
  },
  // Percorsi degli endpoint da documentare
  apis: [
    './src/api/routes/*.js'
  ]
};

// Genera la specifica Swagger
const swaggerSpec = swaggerJsdoc(options);

// Configura Swagger UI
const swaggerUiOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  explorer: true
};

/**
 * Configura Swagger per l'app Express
 * @param {Express} app - Istanza dell'app Express
 */
function setupSwagger(app) {
  try {
    // Rotte Swagger
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
    
    // Endpoint per il file JSON della specifica OpenAPI
    app.get('/api-docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });
    
    logger.info('Documentazione Swagger configurata correttamente');
  } catch (error) {
    logger.error(`Errore nella configurazione di Swagger: ${error.message}`);
  }
}

module.exports = {
  setupSwagger
}; 