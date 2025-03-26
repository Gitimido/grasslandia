FROM node:lts-alpine
ENV NODE_ENV=development
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Set cache permissions to avoid permission issues
RUN mkdir -p node_modules/.cache && chmod -R 777 node_modules/.cache

EXPOSE 4200

# Run with necessary flags for development
CMD ["npm", "run", "start", "--", "--host", "0.0.0.0", "--poll", "2000"]