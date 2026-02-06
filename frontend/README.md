# Cygnusa Guardian - Frontend

React-based frontend for the Glass-Box Hiring Intelligence platform.

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Framer Motion** - Animations
- **Chart.js** - Data visualization
- **Monaco Editor** - Code editor for assessments
- **Lucide React** - Icons

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── dashboard/          # Recruiter dashboard components
│   │   ├── CandidateRoster.jsx
│   │   ├── CandidateDetailTabs.jsx
│   │   ├── DashboardCharts.jsx
│   │   └── DashboardFilters.jsx
│   ├── resume/             # Resume analysis components
│   ├── ui/                 # Reusable UI components
│   ├── IntegrityMonitor.jsx   # Proctoring monitor
│   ├── ShadowProber.jsx       # AI follow-up questions
│   ├── CodeEditor.jsx         # Monaco-based code editor
│   └── DecisionCard.jsx       # Explainable decision display
├── pages/
│   ├── CandidateFlow.jsx      # Assessment workflow
│   ├── RecruiterDashboard.jsx # Recruiter view
│   └── LoginPage.jsx          # Authentication
├── utils/
│   ├── api.js                 # API client
│   └── deviceFingerprint.js   # Device tracking
├── App.jsx                    # Main app with routing
├── main.jsx                   # Entry point
└── index.css                  # Global styles
```

## Environment Variables

Create a `.env.local` file:

```env
VITE_API_URL=http://localhost:8000
```

For production, configure in Vercel dashboard.

## Key Features

### Candidate Flow
- Multi-step assessment wizard
- Real-time code execution
- MCQ and behavioral questions
- Psychometric profiling

### Recruiter Dashboard
- Candidate roster with filters
- Decision cards with full transparency
- Export case files
- Interview scheduling

### Integrity Monitoring
- Webcam face detection
- Tab switch detection
- Copy/paste blocking
- Keystroke dynamics

## Component Guidelines

### Naming Conventions
- Components: `PascalCase.jsx`
- Utilities: `camelCase.js`
- CSS modules: `ComponentName.module.css`

### State Management
- React hooks for local state
- Props drilling for shared state
- API calls in useEffect with cleanup

### Error Handling
```javascript
const [error, setError] = useState(null);
const [loading, setLoading] = useState(false);

const fetchData = async () => {
  setLoading(true);
  try {
    const data = await api.get('/endpoint');
    // handle data
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

## Deployment

The frontend is deployed to Vercel:

1. Connect GitHub repository
2. Set environment variables
3. Deploy automatically on push to main

Build command: `npm run build`
Output directory: `dist`

## License

MIT © 2026 Cygnusa Guardian
