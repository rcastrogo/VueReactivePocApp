// @ts-nocheck
import express from 'express';
import usersHandler from './api/users.js';
import geminiHandler from './api/gemini.js';
import openrouterHandler from './api/openrouter.js';
import groqHandler from './api/groq.js';
import azureHandler from './api/azure.js';
import authMeHandler from './api/auth/me.js';
import authCallbackHandler from './api/auth/callback.js';
import authLoginHandler from './api/auth/login.js';
import authLogoutHandler from './api/auth/logout.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('./public'));

app.all('/api/auth/callback', authCallbackHandler);
app.all('/api/auth/login', authLoginHandler);
app.all('/api/auth/logout', authLogoutHandler);
app.all('/api/auth/me', authMeHandler);

app.all('/api/users', usersHandler);
app.all('/api/gemini', geminiHandler);
app.all('/api/openrouter', openrouterHandler);
app.all('/api/groq', groqHandler);
app.all('/api/azure', azureHandler);
app.listen(PORT, () => {
  console.log(`Servidor Node.js corriendo en http://localhost:${PORT}`);
});