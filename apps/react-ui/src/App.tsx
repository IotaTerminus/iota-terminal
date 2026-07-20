import { Route, Routes } from 'react-router-dom';
import { registerIotaCursor, registerIotaWindow } from '@iota/ui';
import Layout from './layout/Layout';
import Home from './pages/Home';
import AboutMe from './pages/AboutMe';
import AboutSite from './pages/AboutSite';
import Projects from './pages/Projects';
import Resume from './pages/Resume';
import Contact from './pages/Contact';
import NotFound from './pages/NotFound';

registerIotaCursor();
registerIotaWindow();

/**
 * Route paths mirror @iota/content's NAV_ITEMS ids/paths (home, about,
 * stack, projects, resume, contact) so the nav bar and router never drift.
 */
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<AboutMe />} />
        <Route path="stack" element={<AboutSite />} />
        <Route path="projects" element={<Projects />} />
        <Route path="resume" element={<Resume />} />
        <Route path="contact" element={<Contact />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
