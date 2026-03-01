const path = require('node:path');
const express = require('express');

const publicRoutes = require('./routes/public');
const presenterRoutes = require('./routes/presenter');

const app = express();
const publicDir = path.join(__dirname, '..', 'public');
const port = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(publicDir));

app.get('/', (request, response) => {
  response.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/presenter', (request, response) => {
  response.sendFile(path.join(publicDir, 'presenter.html'));
});

app.get('/like', (request, response) => {
  response.sendFile(path.join(publicDir, 'like.html'));
});

app.get('/screen/draw', (request, response) => {
  response.sendFile(path.join(publicDir, 'draw-screen.html'));
});

app.get('/screen/qr', (request, response) => {
  response.sendFile(path.join(publicDir, 'qr-screen.html'));
});

app.use('/api', publicRoutes);
app.use('/api/presenter', presenterRoutes);

app.get('/health', (request, response) => {
  response.json({ ok: true });
});

app.listen(port, () => {
  console.log(`raffle listening on http://localhost:${port}`);
});