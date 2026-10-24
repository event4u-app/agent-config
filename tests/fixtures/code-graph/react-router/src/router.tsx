import { createBrowserRouter } from 'react-router-dom';
import { Settings } from './pages/Settings';

const endpoints = [{ path: '/api/ping', method: 'GET' }];

export const router = createBrowserRouter([
    { path: '/account', Component: Settings },
    { path: '/reports', lazy: () => import('./pages/Reports') },
    { path: '/inline', element: <div>inline</div> },
]);
