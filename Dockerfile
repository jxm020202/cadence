# Cadence — runnable container for Railway / Render / Fly (NOT Vercel: this is a
# persistent Node server that spawns a Python LightGBM scorer, which Vercel's
# serverless model doesn't fit). Secrets are injected as env vars by the host,
# never baked in (see .dockerignore excluding .env).
FROM node:22-bookworm-slim

# libgomp1 = OpenMP runtime LightGBM needs; curl to fetch uv
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates libgomp1 && rm -rf /var/lib/apt/lists/*

# uv (brings its own Python) — the server calls `uv run scripts/score.py`
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /app

# node deps first (layer cache). tsx runs the TS server, so keep dev deps.
COPY package.json ./
RUN npm install

# app + committed model (ml/model/cadence.txt)
COPY . .

# warm the Python env so the first score isn't cold (creates ml/.venv in-image)
RUN cd ml && uv sync

ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
