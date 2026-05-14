import 'dotenv/config';
import express from 'express';
import apiRoutes from './routes';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', apiRoutes);

app.listen(PORT, () => {
  console.log(`SS Cable ERP server running on port ${PORT}`);
});
