import type { ResumeData } from '@iota/types';

/**
 * Placeholder resume data rendered on the Resume page in both frontends.
 * Single source so React and Angular never show different content.
 */
export const RESUME: ResumeData = {
  summary:
    'Middle Developer with full-stack experience delivering production web ' +
    'platform features from architecture through release, with a focus on ' +
    'scalable Node.js services, component-driven Angular interfaces, and ' +
    'pragmatic engineering practices that improve reliability and team velocity.',
  skills: [
    'TypeScript',
    'JavaScript',
    'Python',
    'Go',
    'Rust',
    'HTML',
    'Sass',
    'CSS',
    'Node.js',
    'RESTful APIs',
    'Angular',
    'React',
    'Tailwind',
    'GraphQL',
    'AWS (S3, Cognito, Elastic Beanstalk, CloudWatch)',
    'CI/CD (BitBucket)',
    'Git',
    'GitHub',
    'SQL',
    'SQLite',
    'MongoDB',
    'Jest',
    'Cypress'
  ],
  experience: [
    {
      id: 'webbuy-middle-developer',
      company: 'WebBuy',
      role: 'Middle Developer',
      startDate: '2025-01',
      highlights: [
        'Led end-to-end delivery of complex features, including the Manual Trade-In project: a client-led bypass of standard JDPower lookups with dual-channel notifications to streamline dealer workflows, reduce communication latency, and improve customer and dealer relations while supporting more varied deals.',
        'Architected scalable Node.js and GraphQL microservices alongside component-driven Angular UIs focused on scalability and performance.',
        'Championed architectural best practices and company preferences through code reviews, technical documentation, and mentoring junior engineers and new team members.'
      ]
    },
    {
      id: 'webbuy-jr-developer',
      company: 'WebBuy',
      role: 'Jr. Developer',
      startDate: '2022-01',
      endDate: '2025-01',
      highlights: [
        'Supported migration from monolithic architecture to microservices, improving system stability, deployment agility, and backend security.',
        'Built a Slack-based error-monitoring service for real-time third-party incident response.',
        'Evaluated and integrated emerging technologies to optimize application performance.'
      ]
    },
    {
      id: 'webbuy-intern',
      company: 'WebBuy',
      role: 'Intern',
      startDate: '2021-01',
      endDate: '2021-12',
      highlights: [
        'Automated manual data review via scripting, significantly increasing team productivity and reducing human error.',
        'Contributed to feature delivery within Agile sprint lifecycles.'
      ]
    }
  ],
  education: [
    {
      id: 'rocky-mountain-college-bs-cs',
      institution: 'Rocky Mountain College',
      degree: 'B.S. in Computer Science, Minor in Mathematics (3.8 GPA)',
      graduationYear: 2022
    }
  ]
};
