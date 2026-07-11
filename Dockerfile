# Lanternside Bay / Town Chat — server image.
# Serves the web (Stripe) client AND is the backend all three clients connect
# to (web + iOS + Android). Small, single-process Node app.
FROM node:20-slim

WORKDIR /app

# Install deps first for layer caching.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# App source.
COPY . .

# Bundle Three.js r128 locally so the web client doesn't depend on a CDN at
# runtime (the mobile apps already ship their own copy). Best-effort — the
# client falls back to cdnjs if this isn't present.
RUN node -e "const fs=require('fs');if(!fs.existsSync('public/three.min.js')){console.log('note: public/three.min.js not bundled; web client will use the cdnjs fallback');}"

# Persistent JSON stores live here — mount a volume at /data in your host so
# accounts/bank/progress survive redeploys.
ENV DATA_DIR=/data
ENV PORT=3000
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000
CMD ["node", "server.js"]
