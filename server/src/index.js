import dotenv from 'dotenv';
import app from './app.js';

dotenv.config();

const port = Number(process.env.PORT) || 4000;
// Bind to 0.0.0.0 so the service is reachable inside Railway / Docker / any
// container platform. Locally this still works for http://127.0.0.1:PORT.
const host = '0.0.0.0';

app.listen(port, host, () => {
  console.log(`HMIS API listening on http://${host}:${port}`);
});
