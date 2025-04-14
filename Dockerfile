FROM node:20.12.0-alpine3.19

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./

# Copy source files
COPY . .
# Install dependencies
RUN npm install

# Can you filter the build down to just one app?
RUN npm run build

CMD ["npm", "run", "start"]