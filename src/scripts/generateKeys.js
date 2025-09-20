import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const generateJWTKeys = () => {
  const keysDir = path.join(process.cwd(), 'keys');
  
  // Create keys directory if it doesn't exist
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }

  const privateKeyPath = path.join(keysDir, 'jwtRS256.key');
  const publicKeyPath = path.join(keysDir, 'jwtRS256.key.pub');

  // Check if keys already exist
  if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
    console.log('JWT keys already exist');
    return;
  }

  // Generate RSA key pair
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  // Write keys to files
  fs.writeFileSync(privateKeyPath, privateKey);
  fs.writeFileSync(publicKeyPath, publicKey);
  
  // Set appropriate permissions
  fs.chmodSync(privateKeyPath, 0o600);
  fs.chmodSync(publicKeyPath, 0o644);

  console.log('JWT keys generated successfully');
  console.log(`Private key: ${privateKeyPath}`);
  console.log(`Public key: ${publicKeyPath}`);
};

generateJWTKeys();