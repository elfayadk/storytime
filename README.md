# Storytime: Cross-Platform Timeline Visualization

A modern React-based application for visualizing and analyzing timeline data across multiple platforms. Built with TypeScript, Material-UI, and advanced data visualization capabilities.

## 🌟 Features

### Timeline Visualization
- Interactive timeline view with expandable event cards
- Multi-platform support (GitHub, Twitter, Reddit, RSS)
- Rich event metadata and user information display
- Platform-specific icons and styling
- Sentiment analysis indicators
- Infinite scrolling for large datasets

### Advanced Analytics
- Activity timeline charts
- Sentiment distribution analysis
- Topic clustering visualization
- Platform usage statistics
- Interactive data filtering
- Real-time data updates

### User Experience
- Modern, responsive Material-UI design
- Smooth Framer Motion animations
- Loading states with skeleton screens
- Error handling with retry options
- Empty state handling
- Keyboard navigation support
- Dark/light mode theming

### Data Management
- Efficient data caching
- Export functionality (CSV, JSON)
- Real-time updates
- Data persistence

## 🚀 Getting Started

### Prerequisites
- Node.js (v18.x or higher)
- npm (v9.x or higher)
- WSL2 (for Windows users)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/elfayadk/storytime.git
cd storytime
```

2. Install dependencies:
```bash
cd timeline-ui
npm install
```

3. Create a `.env` file in the timeline-ui directory:
```bash
VITE_API_URL=http://localhost:3000/api
```

4. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or another port if 5173 is in use).

## 🛠️ Tech Stack

- **Frontend Framework**: React with TypeScript
- **Build Tool**: Vite
- **UI Components**: Material-UI (MUI)
- **Animations**: Framer Motion
- **Data Visualization**: Recharts
- **Date Handling**: date-fns
- **State Management**: React Hooks
- **Development Environment**: WSL2

## 📦 Project Structure

```
timeline-ui/
├── src/
│   ├── components/         # React components
│   │   ├── TimelineView/   # Timeline visualization
│   │   ├── Analytics/      # Data visualization
│   │   └── Common/         # Shared components
│   ├── hooks/             # Custom React hooks
│   ├── utils/             # Utility functions
│   ├── types/             # TypeScript definitions
│   └── App.tsx            # Main application
├── public/                # Static assets
└── package.json          # Project dependencies
```

## 🎨 Custom Hooks

- **useAnimations**: Reusable animation configurations
- **useDataCache**: Efficient data caching
- **useKeyboardShortcuts**: Keyboard navigation
- **useInfiniteScroll**: Endless scrolling implementation

## 🔧 Configuration

The application can be configured through environment variables:

- `VITE_API_URL`: Backend API endpoint
- Additional platform-specific configurations (if needed)

## 🚀 Deployment

1. Build the production bundle:
```bash
npm run build
```

2. The build output will be in the `dist` directory, ready for deployment.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request


## 🙏 Acknowledgments

- Material-UI for the component library
- Framer Motion for animations
- Recharts for data visualization
- The React community for inspiration and support
- Yumna, Love of my life
