import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRoutes from './routes';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:3000';

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', apiRoutes);

app.listen(PORT, () => {
  console.log(`SS Cable ERP server running on port ${PORT}`);
});
