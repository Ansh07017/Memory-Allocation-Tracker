# Use Python 3.11 base image
FROM python:3.11

# Set the working directory inside the container
WORKDIR /app

# Copy only the required files first
COPY requirements.txt ./

# Create a virtual environment inside the container
RUN python -m venv venv

# Activate venv and install dependencies
RUN . venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt

# Copy the rest of the application files
COPY . .

# Expose Flask port
EXPOSE 5000

# Run the application
CMD ["bash", "-c", ". venv/bin/activate && python app.py"]
