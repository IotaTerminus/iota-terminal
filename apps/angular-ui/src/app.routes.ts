import type { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { HomeComponent } from './pages/home/home.component';
import { AboutMeComponent } from './pages/about-me/about-me.component';
import { AboutSiteComponent } from './pages/about-site/about-site.component';
import { ProjectsComponent } from './pages/projects/projects.component';
import { ResumeComponent } from './pages/resume/resume.component';
import { GuestbookComponent } from './pages/guestbook/guestbook.component';
// TODO - re-enable contact page
// import { ContactComponent } from './pages/contact/contact.component';
import { NotFoundComponent } from './pages/not-found/not-found.component';

/**
 * Route paths mirror @iota/content's NAV_ITEMS ids/paths (home, about,
 * stack, projects, resume, guestbook, contact) so the nav bar and router
 * never drift.
 */
export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', component: HomeComponent },
      { path: 'about', component: AboutMeComponent },
      { path: 'stack', component: AboutSiteComponent },
      { path: 'projects', component: ProjectsComponent },
      { path: 'resume', component: ResumeComponent },
      { path: 'guestbook', component: GuestbookComponent },
      // TODO - re-enable contact page
      // { path: 'contact', component: ContactComponent },
      { path: '**', component: NotFoundComponent }
    ]
  }
];
