# Chatly - Real-time Chat Application

A modern real-time chat application with real-time messaging, online status tracking, and image sharing capabilities.

## Features

-  Real-time messaging & online status
-  Image sharing
-  Authentication
-  Modern UI with Tailwind CSS
-  Responsive design

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Socket.IO Client
- Tailwind CSS + Shadcn UI

## Prerequisites

Before running this application, you need to:

1. Clone and setup the backend API from [Chatly-api](https://github.com/esmanurgokkaya/Chatly-api)
2. Have MongoDB installed and running
3. Node.js 18+ and pnpm installed

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm installed on your machine
- MongoDB instance running
- Git

### Installation

1. Clone the repository:
\`\`\`bash
git clone https://github.com/esmanurgokkaya/Chatly-app.git
cd Chatly-app
\`\`\`

2. Install dependencies:
\`\`\`bash
pnpm install
\`\`\`

3. Create a \`.env.local\` file in the root directory:
\`\`\`
NEXT_PUBLIC_API_BASE=http://localhost:3000/api
NEXT_PUBLIC_API_URL=http://localhost:3000
\`\`\`

4. Start the development server:
\`\`\`bash
pnpm run dev
\`\`\`

The application will be available at \`http://localhost:3001\` (or another port if 3000 is in use).

## Setup

## Setup Instructions

1. First, setup the backend:
```bash
# Clone the backend repository
git clone https://github.com/esmanurgokkaya/Chatly-api.git
cd Chatly-api

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env file with your MongoDB connection string

# Start the backend server
npm run dev
```

2. Then, setup this frontend application:
```bash
# Clone this repository
git clone https://github.com/esmanurgokkaya/Chatly-app.git
cd Chatly-app

# Install dependencies
pnpm install

# Configure environment variables
cp .env.example .env.local
```

3. Configure your `.env.local`:
```bash
NEXT_PUBLIC_API_BASE=http://localhost:3000/api
NEXT_PUBLIC_API_URL=http://localhost:3000
```

4. Start the development server:
```bash
pnpm run dev
```

The application will be available at `http://localhost:3001`

## API Integration

This frontend application expects the following API endpoints to be available:

- Authentication: `/api/auth/login`, `/api/auth/signup`
- Messages: `/api/messages/send`, `/api/messages/:id`
- Contacts: `/api/contacts`
- Socket.IO connection at the base URL

For full API documentation and endpoints, please refer to the [Chatly-api Repository](https://github.com/esmanurgokkaya/Chatly-api)

## License

MIT

## Author

Esma - [GitHub](https://github.com/esmanurgokkaya)