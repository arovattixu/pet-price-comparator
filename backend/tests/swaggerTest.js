require('dotenv').config();
const express = require('express');
const { setupSwagger } = require('./src/utils/swagger');

// Create a minimal Express app
const app = express();

// Setup Swagger
setupSwagger(app);

// Start the server
const PORT = 5002;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log(`Swagger documentation should be available at http://localhost:${PORT}/api-docs`);
}); 