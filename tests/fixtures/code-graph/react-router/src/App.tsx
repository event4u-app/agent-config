import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import { About } from './pages/About';
import { Settings } from './pages/Settings';

export function App() {
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About title="x" />} />
            <Route path="/settings" component={Settings} />
            <Route element={<Home />}>
                <Route index element={<About />} />
            </Route>
        </Routes>
    );
}
