FROM node:20.12.0-alpine3.19

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./

# Copy source files
COPY . .
# Install dependencies
RUN npm install --ignore-scripts

RUN npm run build

CMD ["npm", "run", "start"]