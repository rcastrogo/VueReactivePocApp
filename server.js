// @ts-nocheck
import express from 'express';
import usersHandler from './api/users.js';
import geminiHandler from './api/gemini.js';
import openrouterHandler from './api/openrouter.js';
import groqHandler from './api/groq.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('./public'));
app.all('/api/users', usersHandler);
app.all('/api/gemini', geminiHandler);
app.all('/api/openrouter', openrouterHandler);
app.all('/api/groq', groqHandler);
app.listen(PORT, () => {
  console.log(`Servidor Node.js corriendo en http://localhost:${PORT}`);
});