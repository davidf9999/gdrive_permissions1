
# Use an official Node.js runtime as a parent image
FROM node:18-slim

# Set the working directory in the container
WORKDIR /app

# Install clasp globally
RUN npm install -g @google/clasp

# Set the entrypoint to clasp
ENTRYPOINT ["clasp"]
