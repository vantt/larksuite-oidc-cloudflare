const crypto = require('crypto');

console.log('Generating 2048-bit RSA Key Pair...');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
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

// Convert public key to JWK
const jwk = crypto.createPublicKey(publicKey).export({ format: 'jwk' });

// Generate random unique key ID (kid)
const kid = crypto.randomBytes(8).toString('hex');
jwk.kid = kid;
jwk.alg = 'RS256';
jwk.use = 'sig';

console.log('\n--- KEY GENERATED SUCCESSFULLY ---');
console.log('\nCopy and paste the following configuration variables to your .env / wrangler configuration / secrets:\n');

console.log('1. JWT_KEY_ID:');
console.log(kid);

console.log('\n2. JWT_PRIVATE_KEY_PEM:');
// Escape newlines so it can be set as a wrangler secret or single-line env string
console.log('"' + privateKey.replace(/\r?\n/g, '\\n') + '"');

console.log('\n3. JWT_PUBLIC_KEY_JWK:');
console.log("'" + JSON.stringify(jwk) + "'");

console.log('\n----------------------------------\n');
console.log('Note: To deploy these to Cloudflare Workers production, run:');
console.log(`  wrangler secret put JWT_KEY_ID --name <value>`);
console.log(`  wrangler secret put JWT_PRIVATE_KEY_PEM (then paste the raw multiline private key PEM, or the escaped single-line)`);
console.log(`  wrangler secret put JWT_PUBLIC_KEY_JWK`);
