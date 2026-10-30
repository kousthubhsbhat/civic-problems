import app from './app';
import { ENV } from './config/env';
import { connectDatabase } from './config/database';

const startServer = async () => {
  // Connect to database
  await connectDatabase();

  app.listen(ENV.PORT, () => {
    console.log(`====================================================`);
    console.log(`🏛️  Smart Civic Grievance Management Platform Backend`);
    console.log(`🚀  Express & TypeScript running on http://localhost:${ENV.PORT}`);
    console.log(`🤖  Python AI Engine URL: ${ENV.PYTHON_AI_SERVICE_URL}`);
    console.log(`💻  Frontend CORS Origin: ${ENV.FRONTEND_URL}`);
    console.log(`====================================================`);
  });
};

startServer();
