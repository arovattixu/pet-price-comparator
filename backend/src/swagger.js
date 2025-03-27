/**
 * Configurazione Swagger separata
 */
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Opzioni di base per Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Pet Price Comparator API',
      version: '1.0.0',
      description: 'API per il comparatore di prezzi di prodotti per animali domestici',
      contact: {
        name: 'Support',
        email: 'support@example.com'
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    tags: [
      { name: 'Products', description: 'Operazioni su prodotti' },
      { name: 'Prices', description: 'Operazioni su prezzi' },
      { name: 'Compare', description: 'Funzionalità di confronto prodotti' },
      { name: 'Deals', description: 'Offerte e migliori occasioni' },
      { name: 'Trends', description: 'Analisi dei trend di prezzo' },
      { name: 'Alerts', description: 'Avvisi di prezzo' },
      { name: 'Advanced Compare', description: 'API per il confronto avanzato dei prezzi con normalizzazione' }
    ],
    components: {
      schemas: {
        Product: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            brand: { type: 'string' },
            price: { type: 'number' },
            description: { type: 'string' },
            category: { type: 'string' },
            petType: { type: 'string' },
            source: { type: 'string' },
            url: { type: 'string' },
            imageUrl: { type: 'string' }
          }
        },
        PricePoint: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            productId: { type: 'string' },
            price: { type: 'number' },
            currency: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            source: { type: 'string' }
          }
        },
        SimilarProduct: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            product1: { $ref: '#/components/schemas/Product' },
            product2: { $ref: '#/components/schemas/Product' },
            similarity: { type: 'number' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            code: { type: 'number' }
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
                message: 'Parametri della richiesta non validi',
                code: 400
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
                message: 'Risorsa non trovata',
                code: 404
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
                message: 'Errore interno del server',
                code: 500
              }
            }
          }
        }
      },
      parameters: {
        productId: {
          name: 'productId',
          in: 'path',
          required: true,
          schema: {
            type: 'string'
          },
          description: 'ID del prodotto'
        },
        limit: {
          name: 'limit',
          in: 'query',
          schema: {
            type: 'integer',
            default: 10
          },
          description: 'Numero massimo di risultati da restituire'
        },
        page: {
          name: 'page',
          in: 'query',
          schema: {
            type: 'integer',
            default: 1
          },
          description: 'Numero di pagina per la paginazione'
        },
        category: {
          name: 'category',
          in: 'path',
          required: true,
          schema: {
            type: 'string'
          },
          description: 'Categoria del prodotto'
        },
        petType: {
          name: 'petType',
          in: 'path',
          required: true,
          schema: {
            type: 'string'
          },
          description: 'Tipo di animale domestico'
        },
        period: {
          name: 'period',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['7days', '30days', '90days', '1year', 'all'],
            default: '30days'
          },
          description: 'Periodo di tempo per l\'analisi'
        }
      }
    },
    paths: {
      '/api/products': {
        get: {
          tags: ['Products'],
          summary: 'Ottiene tutti i prodotti',
          parameters: [
            { $ref: '#/components/parameters/limit' },
            { $ref: '#/components/parameters/page' }
          ],
          responses: {
            '200': {
              description: 'Lista di prodotti',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Product' }
                      },
                      pagination: {
                        type: 'object',
                        properties: {
                          total: { type: 'integer' },
                          page: { type: 'integer' },
                          pages: { type: 'integer' }
                        }
                      }
                    }
                  }
                }
              }
            },
            '500': { $ref: '#/components/responses/ServerError' }
          }
        }
      },
      '/api/products/{productId}': {
        get: {
          tags: ['Products'],
          summary: 'Ottiene un prodotto specifico',
          parameters: [
            { $ref: '#/components/parameters/productId' }
          ],
          responses: {
            '200': {
              description: 'Dettagli del prodotto',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { $ref: '#/components/schemas/Product' }
                    }
                  }
                }
              }
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/ServerError' }
          }
        }
      },
      '/api/products/search': {
        get: {
          tags: ['Products'],
          summary: 'Cerca prodotti',
          parameters: [
            {
              name: 'q',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'Query di ricerca'
            },
            { $ref: '#/components/parameters/limit' },
            { $ref: '#/components/parameters/page' }
          ],
          responses: {
            '200': {
              description: 'Risultati della ricerca',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Product' }
                      },
                      pagination: {
                        type: 'object',
                        properties: {
                          total: { type: 'integer' },
                          page: { type: 'integer' },
                          pages: { type: 'integer' }
                        }
                      }
                    }
                  }
                }
              }
            },
            '500': { $ref: '#/components/responses/ServerError' }
          }
        }
      },
      
      // Route per le offerte (Deals)
      '/api/deals/best': {
        get: {
          tags: ['Deals'],
          summary: 'Recupera i prodotti con i migliori risparmi',
          parameters: [
            { $ref: '#/components/parameters/limit' },
            {
              name: 'minSimilarity',
              in: 'query',
              schema: {
                type: 'number',
                default: 0.7
              },
              description: 'Punteggio minimo di similarità'
            }
          ],
          responses: {
            '200': {
              description: 'Lista delle migliori offerte',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            cheaperProduct: { $ref: '#/components/schemas/Product' },
                            expensiveProduct: { $ref: '#/components/schemas/Product' },
                            savings: { type: 'number' },
                            savingsPercentage: { type: 'number' },
                            similarity: { type: 'number' }
                          }
                        }
                      },
                      meta: {
                        type: 'object',
                        properties: {
                          totalDeals: { type: 'integer' },
                          minSimilarity: { type: 'number' }
                        }
                      }
                    }
                  }
                }
              }
            },
            '500': { $ref: '#/components/responses/ServerError' }
          }
        }
      },
      '/api/deals/best/{petType}': {
        get: {
          tags: ['Deals'],
          summary: 'Recupera i prodotti con i migliori risparmi per un tipo di animale domestico',
          parameters: [
            { $ref: '#/components/parameters/petType' },
            { $ref: '#/components/parameters/limit' },
            {
              name: 'minSimilarity',
              in: 'query',
              schema: {
                type: 'number',
                default: 0.7
              },
              description: 'Punteggio minimo di similarità'
            }
          ],
          responses: {
            '200': {
              description: 'Lista delle migliori offerte per il tipo di animale specificato',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            cheaperProduct: { $ref: '#/components/schemas/Product' },
                            expensiveProduct: { $ref: '#/components/schemas/Product' },
                            savings: { type: 'number' },
                            savingsPercentage: { type: 'number' },
                            similarity: { type: 'number' }
                          }
                        }
                      },
                      meta: {
                        type: 'object',
                        properties: {
                          totalDeals: { type: 'integer' },
                          petType: { type: 'string' },
                          minSimilarity: { type: 'number' }
                        }
                      }
                    }
                  }
                }
              }
            },
            '500': { $ref: '#/components/responses/ServerError' }
          }
        }
      },
      
      // Trends routes
      '/api/trends/price-history/{productId}': {
        get: {
          tags: ['Trends'],
          summary: 'Recupera lo storico dei prezzi di un prodotto',
          parameters: [
            { $ref: '#/components/parameters/productId' },
            { $ref: '#/components/parameters/period' }
          ],
          responses: {
            '200': {
              description: 'Storico dei prezzi',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          productId: { type: 'string' },
                          productName: { type: 'string' },
                          period: { type: 'string' },
                          priceHistory: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                price: { type: 'number' },
                                date: { type: 'string', format: 'date-time' }
                              }
                            }
                          },
                          stats: {
                            type: 'object',
                            properties: {
                              min: { type: 'number' },
                              max: { type: 'number' },
                              avg: { type: 'number' },
                              trend: { type: 'string' }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/ServerError' }
          }
        }
      },
      '/api/advanced-compare/unit-prices/{productId}': {
        get: {
          summary: 'Confronta un prodotto con prodotti simili usando prezzi unitari',
          tags: ['Advanced Compare'],
          parameters: [
            {
              in: 'path',
              name: 'productId',
              schema: {
                type: 'string'
              },
              required: true,
              description: 'ID del prodotto da confrontare'
            }
          ],
          responses: {
            '200': {
              description: 'Confronto completato con successo',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean'
                      },
                      data: {
                        type: 'object',
                        properties: {
                          originalProduct: {
                            type: 'object'
                          },
                          groupedProducts: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                baseProduct: {
                                  type: 'string'
                                },
                                brand: {
                                  type: 'string'
                                },
                                variants: {
                                  type: 'array',
                                  items: {
                                    type: 'object'
                                  }
                                },
                                bestValue: {
                                  type: 'object'
                                },
                                priceRange: {
                                  type: 'object'
                                },
                                unitPriceRange: {
                                  type: 'object'
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '404': {
              description: 'Prodotto non trovato'
            },
            '500': {
              description: 'Errore del server'
            }
          }
        }
      },
      '/api/advanced-compare/best-value/{brand}/{category}': {
        get: {
          summary: 'Trova prodotti con miglior rapporto qualità/prezzo per un brand',
          tags: ['Advanced Compare'],
          parameters: [
            {
              in: 'path',
              name: 'brand',
              schema: {
                type: 'string'
              },
              required: true,
              description: 'Nome del brand'
            },
            {
              in: 'path',
              name: 'category',
              schema: {
                type: 'string'
              },
              required: false,
              description: 'Categoria (opzionale)'
            },
            {
              in: 'query',
              name: 'limit',
              schema: {
                type: 'integer',
                default: 10
              },
              required: false,
              description: 'Limite risultati'
            }
          ],
          responses: {
            '200': {
              description: 'Ricerca completata',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean'
                      },
                      data: {
                        type: 'object',
                        properties: {
                          brand: {
                            type: 'string'
                          },
                          category: {
                            type: 'string'
                          },
                          groupCount: {
                            type: 'integer'
                          },
                          bestValueProducts: {
                            type: 'array'
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '500': {
              description: 'Errore del server'
            }
          }
        }
      },
      '/api/advanced-compare/sizes': {
        get: {
          summary: 'Confronta diverse dimensioni di prodotti simili',
          tags: ['Advanced Compare'],
          parameters: [
            {
              in: 'query',
              name: 'namePattern',
              schema: {
                type: 'string'
              },
              required: true,
              description: 'Pattern del nome prodotto da cercare'
            }
          ],
          responses: {
            '200': {
              description: 'Confronto dimensioni completato',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean'
                      },
                      data: {
                        type: 'object',
                        properties: {
                          namePattern: {
                            type: 'string'
                          },
                          brandCount: {
                            type: 'integer'
                          },
                          productCount: {
                            type: 'integer'
                          },
                          brandComparison: {
                            type: 'array'
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '400': {
              description: 'Parametri di query non validi'
            },
            '500': {
              description: 'Errore del server'
            }
          }
        }
      },
      '/api/advanced-compare/update-unit-prices': {
        post: {
          summary: 'Aggiorna i prezzi unitari per tutti i prodotti',
          tags: ['Advanced Compare'],
          parameters: [
            {
              in: 'query',
              name: 'limit',
              schema: {
                type: 'integer',
                default: 1000
              },
              required: false,
              description: 'Limite prodotti da aggiornare'
            }
          ],
          responses: {
            '200': {
              description: 'Aggiornamento completato',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean'
                      },
                      data: {
                        type: 'object',
                        properties: {
                          totalProcessed: {
                            type: 'integer'
                          },
                          updated: {
                            type: 'integer'
                          },
                          failed: {
                            type: 'integer'
                          },
                          errors: {
                            type: 'array'
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '500': {
              description: 'Errore del server'
            }
          }
        }
      }
    }
  },
  apis: [] // Nessun file API da scansionare, usiamo la definizione statica sopra
};

// Genera la documentazione Swagger
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Funzione per configurare Swagger nell'app Express
const setupSwagger = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
  
  console.log('Swagger UI disponibile su /api-docs');
  console.log('Swagger JSON disponibile su /swagger.json');
};

module.exports = {
  setupSwagger,
  swaggerSpec
}; 