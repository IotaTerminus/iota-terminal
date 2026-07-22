import { Route, Routes } from 'react-router-dom';
import { registerIotaCursor, registerIotaWindow, registerIotaTerminal } from '@iota/ui';
import Layout from './layout/Layout';
import Home from './pages/Home';
import AboutMe from './pages/AboutMe';
import AboutSite from './pages/AboutSite';
import Projects from './pages/Projects';
import Resume from './pages/Resume';
import Guestbook from './pages/Guestbook';
// TODO - re-enable contact page
// import Contact from './pages/Contact';
import NotFound from './pages/NotFound';

registerIotaCursor();
registerIotaWindow();
registerIotaTerminal();

/**
 * Route paths mirror @iota/content's NAV_ITEMS ids/paths (home, about,
 * stack, projects, resume, guestbook, contact) so the nav bar and router
 * never drift.
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
        <Route path="guestbook" element={<Guestbook />} />
        {/* TODO - re-enable contact page */}
        {/* <Route path="contact" element={<Contact />} /> */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
