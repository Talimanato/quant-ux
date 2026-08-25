import fs from 'fs';
import path from 'path';
import { createApp } from './app';
import { loadConfig } from './config';

const configPath = process.env.QUX_CONFIG || path.join(process.cwd(), 'matc.conf');
const config = loadConfig(fs.existsSync(configPath) ? configPath : undefined);

const { app } = createApp(config);

app.listen(config.httpPort, '0.0.0.0', () => {
  console.log('******************************************');
  console.log(`* Quant-UX-Server launched at ${config.httpPort}`);
  console.log('******************************************');
});
