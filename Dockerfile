FROM node:latest

# Set working directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application files
COPY . .

# Expose the port
EXPOSE 1221

# Start the app
CMD ["node", "."]
