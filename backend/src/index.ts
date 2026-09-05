import dotenv from 'dotenv';
dotenv.config();

import app from './app';

const PORT = parseInt(process.env.PORT || '3001', 10);

app.listen(PORT, () => {
  console.log(`[LedgerLens API] Server running on http://localhost:${PORT}`);
  console.log(`[LedgerLens API] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[LedgerLens API] Health check: http://localhost:${PORT}/api/health`);
});

export default app;
