export interface Experience {
  id: string;
  company: string;
  role: string;
  startDate: string;
  endDate?: string;
  highlights: string[];
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  graduationYear: number;
}

export interface ResumeData {
  summary: string;
  skills: string[];
  experience: Experience[];
  education: Education[];
}
