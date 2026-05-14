import 'dotenv/config';
import express from 'express';
import authRoutes from './routes/auth';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`SS Cable ERP server running on port ${PORT}`);
});
