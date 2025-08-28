# Dockerfile for the Permission Manager Setup Environment

# Use a Debian base image
FROM debian:bookworm

# Set environment variables for non-interactive setup
ENV DEBIAN_FRONTEND=noninteractive

# Install necessary packages
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    nodejs \
    npm \
    python3 \
    xz-utils \
    wget \
    && apt-get clean

# Install Google Cloud SDK using the interactive installer
RUN curl https://sdk.cloud.google.com | bash -s -- --disable-prompts

# Add gcloud to the PATH
ENV PATH="/root/google-cloud-sdk/bin:${PATH}"

# Install alpha components
RUN gcloud components install alpha -q

# Install Terraform
ENV TERRAFORM_VERSION=1.5.7
RUN curl -LO https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip && \
    unzip terraform_${TERRAFORM_VERSION}_linux_amd64.zip && \
    mv terraform /usr/local/bin/ && \
    rm terraform_${TERRAFORM_VERSION}_linux_amd64.zip

# Install @google/clasp globally using npm
RUN npm install -g @google/clasp

# Install GAM (Google Apps Manager)
RUN wget https://github.com/GAM-team/GAM/releases/download/v7.19.02/gam-7.19.02-linux-x86_64-glibc2.39.tar.xz -O /tmp/gam.tar.xz
RUN tar -xvf /tmp/gam.tar.xz -C /tmp
RUN mv /tmp/gam7/gam /usr/local/bin/

# Set up the working directory
WORKDIR /app

# Copy the project files into the container
COPY . .

# Make the setup script executable
RUN chmod +x /app/scripts/setup.sh

# Set the entrypoint to the setup wizard script
ENTRYPOINT ["/app/scripts/setup.sh"]