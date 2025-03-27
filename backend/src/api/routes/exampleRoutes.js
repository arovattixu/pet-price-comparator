/**
 * @swagger
 * tags:
 *   name: Example
 *   description: API di esempio
 */
const express = require('express');
const router = express.Router();

/**
 * @swagger
 * /api/example:
 *   get:
 *     summary: Recupera un elenco di esempi
 *     tags: [Example]
 *     responses:
 *       200:
 *         description: Lista di esempi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "1"
 *                       name:
 *                         type: string
 *                         example: "Esempio 1"
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: '1', name: 'Esempio 1' },
      { id: '2', name: 'Esempio 2' }
    ]
  });
});

/**
 * @swagger
 * /api/example/{id}:
 *   get:
 *     summary: Recupera un esempio per ID
 *     tags: [Example]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID dell'esempio
 *     responses:
 *       200:
 *         description: Dettagli dell'esempio
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "1"
 *                     name:
 *                       type: string
 *                       example: "Esempio 1"
 *                     description:
 *                       type: string
 *                       example: "Questo è un esempio"
 *       404:
 *         description: Esempio non trovato
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;
  res.json({
    success: true,
    data: {
      id,
      name: `Esempio ${id}`,
      description: "Questo è un esempio"
    }
  });
});

module.exports = router; 