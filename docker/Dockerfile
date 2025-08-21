# Dockerfile for the Permission Manager Setup Environment

# Use the official Google Cloud SDK image as a base
# This provides gcloud, gsutil, and a Debian-based environment.
FROM google/cloud-sdk:latest

# Set environment variables for non-interactive setup
ENV DEBIAN_FRONTEND=noninteractive

# Install necessary packages: curl, unzip, nodejs, npm
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    nodejs \
    npm \
    && apt-get clean

# Install gcloud alpha components
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
# This will install GAM into /root/bin/gamadv-xtd3/gam
RUN bash <(curl -s -L https://gam-shortn.appspot.com/gam-install.sh) -l -d /root/bin

# Add the GAM directory to the PATH
ENV PATH="/root/bin/gamadv-xtd3:${PATH}"

# Set up the working directory
WORKDIR /app

# Copy the project files into the container
COPY . .

# Make the setup script executable
RUN chmod +x /app/scripts/setup.sh

# Set the entrypoint to the setup wizard script
ENTRYPOINT ["/app/scripts/setup.sh"]