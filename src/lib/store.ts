import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import { db, auth } from '../firebase';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';

export interface Reminder {
  id: string;
  row: number;
  message: string;
}

export interface ChartData {
  width: number;
  height: number;
  cells: Record<string, string>;
  symbols?: Record<string, string>;
  zoom?: number;
  pipSize?: { w: number; h: number };
  pipPos?: { x: number; y: number };
}

export interface GaugeData {
  stitches: number;
  rows: number;
  width: number;
  length: number;
  unit: 'cm' | 'inch';
  patternStitches?: number;
  patternRows?: number;
  patternWidth?: number;
  patternLength?: number;
}

export interface Counter {
  id: string;
  name: string;
  value: number;
  target?: number;
  reminders?: Reminder[];
  notes?: string;
}

export interface Project {
  id: string;
  name: string;
  counters: Counter[];
  pdfId?: string;
  createdAt: number;
  notes?: string;
  userId?: string;
  chart?: ChartData;
  gauge?: GaugeData;
}

const projectsStore = localforage.createInstance({
  name: 'KnitTracker',
  storeName: 'projects'
});

const pdfsStore = localforage.createInstance({
  name: 'KnitTracker',
  storeName: 'pdfs'
});

export const store = {
  async getProjects(): Promise<Project[]> {
    if (auth.currentUser) {
      const snapshot = await getDocs(collection(db, 'users', auth.currentUser.uid, 'projects'));
      return snapshot.docs.map(doc => doc.data() as Project).sort((a, b) => b.createdAt - a.createdAt);
    } else {
      const projects = await projectsStore.getItem<Project[]>('all_projects');
      return (projects || []).sort((a, b) => b.createdAt - a.createdAt);
    }
  },

  async saveProjects(projects: Project[]): Promise<void> {
    if (!auth.currentUser) {
      await projectsStore.setItem('all_projects', projects);
    }
  },

  async addProject(name: string): Promise<Project> {
    const newProject: Project = {
      id: uuidv4(),
      name,
      counters: [{ id: uuidv4(), name: 'Main', value: 0, reminders: [] }],
      createdAt: Date.now()
    };
    
    if (auth.currentUser) {
      newProject.userId = auth.currentUser.uid;
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'projects', newProject.id), newProject);
    } else {
      const projects = await this.getProjects();
      projects.push(newProject);
      await this.saveProjects(projects);
    }
    return newProject;
  },

  async updateProject(project: Project): Promise<void> {
    if (auth.currentUser) {
      project.userId = auth.currentUser.uid;
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'projects', project.id), project);
    } else {
      const projects = await this.getProjects();
      const index = projects.findIndex(p => p.id === project.id);
      if (index !== -1) {
        projects[index] = project;
        await this.saveProjects(projects);
      }
    }
  },

  async deleteProject(id: string): Promise<void> {
    const projects = await this.getProjects();
    const project = projects.find(p => p.id === id);
    if (project?.pdfId) {
      await this.deletePdf(project.pdfId);
    }
    
    if (auth.currentUser) {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'projects', id));
    } else {
      const newProjects = projects.filter(p => p.id !== id);
      await this.saveProjects(newProjects);
    }
  },

  async savePdf(file: File): Promise<string> {
    const id = uuidv4();
    await pdfsStore.setItem(id, file);
    return id;
  },

  async getPdf(id: string): Promise<File | null> {
    return await pdfsStore.getItem<File>(id);
  },

  async deletePdf(id: string): Promise<void> {
    await pdfsStore.removeItem(id);
  },
  
  async migrateLocalToFirebase(userId: string): Promise<void> {
    const localProjects = await projectsStore.getItem<Project[]>('all_projects') || [];
    if (localProjects.length > 0) {
      for (const project of localProjects) {
        project.userId = userId;
        await setDoc(doc(db, 'users', userId, 'projects', project.id), project);
      }
      await projectsStore.setItem('all_projects', []);
    }
  }
};
