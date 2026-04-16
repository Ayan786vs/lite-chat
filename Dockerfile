# Use standard Node.js image
FROM node:18-slim

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install --production

# Bundle app source
COPY . .

# Expose port (Cloud Run sets PORT automatically)
EXPOSE 3000

# Start server
CMD [ "node", "server.js" ]
