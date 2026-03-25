import React, { useState, useEffect } from 'react';
import { Plus, Trash2, FileText, ChevronLeft, Minus, Upload, Bell, X, ChevronDown, ChevronUp, Edit2, RotateCcw, StickyNote } from 'lucide-react';
import { store, Project, Counter } from './lib/store';
import { cn } from './lib/utils';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { v4 as uuidv4 } from 'uuid';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, db } from './firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { GaugeCalculator } from './components/GaugeCalculator';
import { KnittingChart, TrackChart } from './components/KnittingChart';

// Set up pdf.js worker locally for offline support
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(auth.currentUser);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await store.migrateLocalToFirebase(currentUser.uid);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;

    if (user) {
      const q = query(collection(db, 'users', user.uid, 'projects'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedProjects = snapshot.docs.map(doc => doc.data() as Project).sort((a, b) => b.createdAt - a.createdAt);
        setProjects(fetchedProjects);
        setLoading(false);
        if (currentProject) {
          const updatedActive = fetchedProjects.find(p => p.id === currentProject.id);
          if (updatedActive) setCurrentProject(updatedActive);
        }
      });
      return () => unsubscribe();
    } else {
      loadProjects();
    }
  }, [user, isAuthReady]); // eslint-disable-next-line react-hooks/exhaustive-deps

  const loadProjects = async () => {
    const data = await store.getProjects();
    setProjects(data.sort((a, b) => b.createdAt - a.createdAt));
    setLoading(false);
  };

  const handleCreateProject = async (name: string) => {
    if (!name.trim()) return;
    const newProject = await store.addProject(name);
    setProjects([newProject, ...projects]);
  };

  const handleDeleteProject = async (id: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      await store.deleteProject(id);
      if (!user) {
        setProjects(projects.filter(p => p.id !== id));
      }
      if (currentProject?.id === id) {
        setCurrentProject(null);
      }
    }
  };

  const handleUpdateProject = async (project: Project) => {
    if (!user) {
      setProjects(projects.map(p => p.id === project.id ? project : p));
    }
    setCurrentProject(project);
    await store.updateProject(project);
  };

  if (loading || !isAuthReady) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      {currentProject ? (
        <ProjectDetail 
          project={currentProject} 
          onBack={() => setCurrentProject(null)} 
          onUpdate={handleUpdateProject}
        />
      ) : (
        <ProjectList 
          projects={projects} 
          onCreate={handleCreateProject} 
          onSelect={setCurrentProject}
          onDelete={handleDeleteProject}
        />
      )}
    </div>
  );
}

function ProjectList({ 
  projects, 
  onCreate, 
  onSelect, 
  onDelete 
}: { 
  projects: Project[], 
  onCreate: (name: string) => void,
  onSelect: (project: Project) => void,
  onDelete: (id: string) => void
}) {
  const [newName, setNewName] = useState('');
  const user = auth.currentUser;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(newName);
    setNewName('');
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <header className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-800">My Projects</h1>
          <p className="text-stone-500 mt-1">Track your knitting progress</p>
        </div>
        <div>
          {user ? (
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-stone-500 font-medium">{user.email}</span>
              <button 
                onClick={() => signOut(auth)}
                className="text-xs text-stone-600 hover:text-stone-900 underline"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button 
              onClick={() => signInWithPopup(auth, googleProvider)}
              className="text-sm bg-white border border-stone-300 text-stone-700 px-3 py-1.5 rounded-lg hover:bg-stone-50 transition-colors shadow-sm"
            >
              Sign In to Sync
            </button>
          )}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="mb-8 flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New project name..."
          className="flex-1 rounded-lg border border-stone-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-stone-500"
        />
        <button 
          type="submit"
          disabled={!newName.trim()}
          className="bg-stone-800 text-white px-4 py-2 rounded-lg hover:bg-stone-700 disabled:opacity-50 flex items-center gap-2"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Add</span>
        </button>
      </form>

      <div className="space-y-3">
        {projects.length === 0 ? (
          <div className="text-center py-12 text-stone-400 bg-white rounded-xl border border-stone-200 border-dashed">
            No projects yet. Create one to get started!
          </div>
        ) : (
          projects.map(project => (
            <div 
              key={project.id}
              className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between group cursor-pointer"
              onClick={() => onSelect(project)}
            >
              <div>
                <h3 className="font-semibold text-lg">{project.name}</h3>
                <div className="text-sm text-stone-500 flex items-center gap-4 mt-1">
                  <span>{project.counters.length} counter{project.counters.length !== 1 ? 's' : ''}</span>
                  {project.pdfId && (
                    <span className="flex items-center gap-1 text-blue-600">
                      <FileText size={14} /> PDF attached
                    </span>
                  )}
                </div>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(project.id);
                }}
                className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 sm:opacity-100"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ProjectDetail({ 
  project, 
  onBack, 
  onUpdate 
}: { 
  project: Project, 
  onBack: () => void,
  onUpdate: (project: Project) => void
}) {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [showPdf, setShowPdf] = useState(false);
  const [editingReminders, setEditingReminders] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [dismissedReminders, setDismissedReminders] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'track' | 'chart' | 'gauge'>('track');
  const [isPiP, setIsPiP] = useState(false);

  useEffect(() => {
    if (project.pdfId) {
      store.getPdf(project.pdfId).then(file => {
        if (file) setPdfFile(file);
      });
    }
  }, [project.pdfId]);

  const handleIncrement = (counterId: string) => {
    const newCounters = project.counters.map(c => 
      c.id === counterId ? { ...c, value: c.value + 1 } : c
    );
    onUpdate({ ...project, counters: newCounters });
  };

  const handleDecrement = (counterId: string) => {
    const newCounters = project.counters.map(c => 
      c.id === counterId ? { ...c, value: Math.max(0, c.value - 1) } : c
    );
    onUpdate({ ...project, counters: newCounters });
  };

  const handleAddCounter = () => {
    const name = prompt('Counter name:');
    if (name) {
      onUpdate({
        ...project,
        counters: [...project.counters, { id: uuidv4(), name, value: 0 }]
      });
    }
  };

  const handleEditCounterName = (counterId: string, currentName: string) => {
    const name = prompt('Edit counter name:', currentName);
    if (name && name.trim()) {
      const newCounters = project.counters.map(c => 
        c.id === counterId ? { ...c, name: name.trim() } : c
      );
      onUpdate({ ...project, counters: newCounters });
    }
  };

  const handleEditCounterValue = (counterId: string, currentValue: number) => {
    const valueStr = prompt('Set counter value:', currentValue.toString());
    if (valueStr !== null) {
      const value = parseInt(valueStr, 10);
      if (!isNaN(value) && value >= 0) {
        const newCounters = project.counters.map(c => 
          c.id === counterId ? { ...c, value } : c
        );
        onUpdate({ ...project, counters: newCounters });
      }
    }
  };

  const handleResetCounter = (counterId: string) => {
    if (confirm('Are you sure you want to reset this counter to 0?')) {
      const newCounters = project.counters.map(c => 
        c.id === counterId ? { ...c, value: 0 } : c
      );
      onUpdate({ ...project, counters: newCounters });
    }
  };

  const handleUpdateCounterNotes = (counterId: string, notes: string) => {
    const newCounters = project.counters.map(c => 
      c.id === counterId ? { ...c, notes } : c
    );
    onUpdate({ ...project, counters: newCounters });
  };

  const handleDeleteCounter = (counterId: string) => {
    if (project.counters.length <= 1) {
      alert('You must have at least one counter.');
      return;
    }
    if (confirm('Delete this counter?')) {
      onUpdate({
        ...project,
        counters: project.counters.filter(c => c.id !== counterId)
      });
    }
  };

  const handleAddReminders = (counterId: string, rows: number[], message: string) => {
    const newCounters = project.counters.map(c => {
      if (c.id === counterId) {
        const reminders = c.reminders || [];
        const newReminders = rows.map(row => ({ id: uuidv4(), row, message }));
        return { ...c, reminders: [...reminders, ...newReminders] };
      }
      return c;
    });
    onUpdate({ ...project, counters: newCounters });
  };

  const handleDeleteReminder = (counterId: string, reminderId: string) => {
    const newCounters = project.counters.map(c => {
      if (c.id === counterId) {
        return { ...c, reminders: (c.reminders || []).filter(r => r.id !== reminderId) };
      }
      return c;
    });
    onUpdate({ ...project, counters: newCounters });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      const id = await store.savePdf(file);
      if (project.pdfId) {
        await store.deletePdf(project.pdfId);
      }
      onUpdate({ ...project, pdfId: id });
      setPdfFile(file);
      setPageNumber(1);
    }
  };

  const handleRemovePdf = async () => {
    if (confirm('Remove PDF from this project?')) {
      if (project.pdfId) {
        await store.deletePdf(project.pdfId);
      }
      onUpdate({ ...project, pdfId: undefined });
      setPdfFile(null);
      setShowPdf(false);
    }
  };

  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    setNumPages(numPages);
  }

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden">
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 -ml-2 text-stone-500 hover:bg-stone-100 rounded-full transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold truncate max-w-[200px] sm:max-w-md">{project.name}</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1 bg-stone-100 p-1 rounded-lg">
            <button onClick={() => setActiveTab('track')} className={cn("px-3 py-1.5 text-sm font-medium rounded-md transition-colors", activeTab === 'track' ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700")}>Track</button>
            <button onClick={() => setActiveTab('chart')} className={cn("px-3 py-1.5 text-sm font-medium rounded-md transition-colors", activeTab === 'chart' ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700")}>Chart</button>
            <button onClick={() => setActiveTab('gauge')} className={cn("px-3 py-1.5 text-sm font-medium rounded-md transition-colors", activeTab === 'gauge' ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700")}>Gauge</button>
          </div>
          {activeTab === 'track' && pdfFile && (
            <button
              onClick={() => setShowPdf(!showPdf)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                showPdf ? "bg-blue-100 text-blue-700" : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              )}
            >
              <FileText size={16} />
              <span className="hidden sm:inline">{showPdf ? 'Hide PDF' : 'Show PDF'}</span>
            </button>
          )}
        </div>
      </header>

      <div className="sm:hidden flex items-center gap-1 bg-stone-100 p-2 border-b border-stone-200">
        <button onClick={() => setActiveTab('track')} className={cn("flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors", activeTab === 'track' ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700")}>Track</button>
        <button onClick={() => setActiveTab('chart')} className={cn("flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors", activeTab === 'chart' ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700")}>Chart</button>
        <button onClick={() => setActiveTab('gauge')} className={cn("flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors", activeTab === 'gauge' ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700")}>Gauge</button>
      </div>

      <div className={cn(
        "flex-1 overflow-hidden flex flex-col md:flex-row",
        showPdf && activeTab === 'track' ? "md:divide-x md:divide-stone-200" : ""
      )}>
        {activeTab === 'gauge' && (
          <div className="flex-1 overflow-y-auto bg-stone-50">
            <GaugeCalculator project={project} onUpdate={onUpdate} />
          </div>
        )}

        {activeTab === 'chart' && (
          <div className="flex-1 overflow-hidden">
            <KnittingChart project={project} onUpdate={onUpdate} currentRow={project.counters[0]?.value || 0} />
          </div>
        )}

        {activeTab === 'track' && (
          <>
            {/* Counters Section */}
            <div className={cn(
              "flex-1 overflow-y-auto p-4 sm:p-6",
              showPdf ? "hidden md:block md:max-w-sm lg:max-w-md" : ""
            )}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-stone-800">Counters</h2>
            <button 
              onClick={handleAddCounter}
              className="text-sm text-stone-600 hover:text-stone-900 flex items-center gap-1"
            >
              <Plus size={16} /> Add Counter
            </button>
          </div>

          <div className="space-y-4">
            {project.counters.map(counter => {
              const activeReminders = (counter.reminders || []).filter(r => r.row - 1 === counter.value && !dismissedReminders.has(`${r.id}-${counter.value}`));
              const isEditingReminders = editingReminders === counter.id;
              const isEditingNotes = editingNotes === counter.id;

              return (
                <div key={counter.id} className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-stone-700">{counter.name}</h3>
                      <button
                        onClick={() => handleEditCounterName(counter.id, counter.name)}
                        className="text-stone-400 hover:text-stone-600 transition-colors p-1"
                        title="Edit Name"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingReminders(isEditingReminders ? null : counter.id);
                          if (!isEditingReminders) setEditingNotes(null);
                        }}
                        className={cn("p-1.5 rounded-md transition-colors", isEditingReminders ? "bg-stone-200 text-stone-800" : "text-stone-400 hover:bg-stone-100 hover:text-stone-600")}
                        title="Reminders"
                      >
                        <Bell size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingNotes(isEditingNotes ? null : counter.id);
                          if (!isEditingNotes) setEditingReminders(null);
                        }}
                        className={cn("p-1.5 rounded-md transition-colors", isEditingNotes ? "bg-stone-200 text-stone-800" : "text-stone-400 hover:bg-stone-100 hover:text-stone-600")}
                        title="Notes"
                      >
                        <StickyNote size={16} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleResetCounter(counter.id)}
                        className="text-stone-400 hover:text-stone-600 transition-colors p-1.5"
                        title="Reset Counter"
                      >
                        <RotateCcw size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteCounter(counter.id)}
                        className="text-stone-400 hover:text-red-500 transition-colors p-1.5"
                        title="Delete Counter"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  
                  {activeReminders.length > 0 && (
                    <div className="mb-4 space-y-2">
                      {activeReminders.map(r => (
                        <div key={r.id} className="bg-amber-100 text-amber-900 px-3 py-2 rounded-lg text-sm font-medium flex items-start justify-between gap-2 border border-amber-200">
                          <div className="flex items-start gap-2">
                            <Bell size={16} className="mt-0.5 shrink-0" />
                            <span><span className="font-bold">Next Row ({r.row}):</span> {r.message}</span>
                          </div>
                          <button 
                            onClick={() => setDismissedReminders(prev => new Set(prev).add(`${r.id}-${counter.value}`))}
                            className="text-amber-700 hover:text-amber-900 p-0.5 shrink-0"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-6">
                    <button 
                      onClick={() => handleDecrement(counter.id)}
                      className="w-14 h-14 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center hover:bg-stone-200 active:bg-stone-300 transition-colors"
                    >
                      <Minus size={24} />
                    </button>
                    
                    <button 
                      onClick={() => handleEditCounterValue(counter.id, counter.value)}
                      className="text-5xl font-bold text-stone-800 w-24 text-center font-mono tracking-tighter hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                      title="Edit Value"
                    >
                      {counter.value}
                    </button>
                    
                    <button 
                      onClick={() => handleIncrement(counter.id)}
                      className="w-14 h-14 rounded-full bg-stone-800 text-white flex items-center justify-center hover:bg-stone-700 active:bg-stone-900 transition-colors shadow-md"
                    >
                      <Plus size={24} />
                    </button>
                  </div>

                  {isEditingNotes && (
                    <div className="mt-4 pt-4 border-t border-stone-100">
                      <h4 className="text-sm font-medium text-stone-700 mb-2">Part Notes</h4>
                      <textarea
                        value={counter.notes || ''}
                        onChange={(e) => handleUpdateCounterNotes(counter.id, e.target.value)}
                        placeholder="Add specific notes for this part (e.g., stitch counts, shaping instructions)..."
                        className="w-full h-24 p-3 rounded-xl border border-stone-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-stone-500 resize-y bg-white text-sm"
                      />
                    </div>
                  )}

                  {isEditingReminders && (
                    <div className="mt-4 pt-4 border-t border-stone-100">
                      <h4 className="text-sm font-medium text-stone-700 mb-2">Reminders</h4>
                      <div className="space-y-2 mb-3">
                        {(counter.reminders || []).length === 0 ? (
                          <p className="text-xs text-stone-500 italic">No reminders set.</p>
                        ) : (
                          (counter.reminders || []).sort((a,b) => a.row - b.row).map(r => (
                            <div key={r.id} className="flex items-center justify-between text-sm bg-stone-50 px-2 py-1.5 rounded border border-stone-100">
                              <span className="font-medium text-stone-600 w-12">Row {r.row}</span>
                              <span className="text-stone-800 flex-1 truncate px-2">{r.message}</span>
                              <button onClick={() => handleDeleteReminder(counter.id, r.id)} className="text-stone-400 hover:text-red-500">
                                <X size={14} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.currentTarget;
                          const rowsStr = (form.elements.namedItem('rows') as HTMLInputElement).value;
                          const msg = (form.elements.namedItem('message') as HTMLInputElement).value;
                          
                          const rows = rowsStr.split(',')
                            .map(s => parseInt(s.trim(), 10))
                            .filter(n => !isNaN(n) && n >= 0);

                          if (rows.length > 0 && msg.trim()) {
                            handleAddReminders(counter.id, rows, msg.trim());
                            form.reset();
                          } else if (rows.length === 0) {
                            alert('Please enter valid row numbers (e.g., 5, 10, 15)');
                          }
                        }}
                        className="flex gap-2"
                      >
                        <input type="text" name="rows" placeholder="Rows (e.g. 5, 10)" required className="w-32 text-sm rounded border border-stone-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-stone-500" />
                        <input type="text" name="message" placeholder="Message..." required className="flex-1 text-sm rounded border border-stone-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-stone-500" />
                        <button type="submit" className="bg-stone-800 text-white px-3 py-1.5 rounded text-sm hover:bg-stone-700 transition-colors">Add</button>
                      </form>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!pdfFile && (
            <div className="mt-8 border-t border-stone-200 pt-8">
              <h2 className="text-lg font-semibold text-stone-800 mb-4">Pattern PDF</h2>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-stone-300 border-dashed rounded-xl cursor-pointer bg-stone-50 hover:bg-stone-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-3 text-stone-400" />
                  <p className="mb-2 text-sm text-stone-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                  <p className="text-xs text-stone-500">PDF files only</p>
                </div>
                <input type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} />
              </label>
            </div>
          )}

          {/* Track Chart Section */}
          {project.chart && Object.keys(project.chart.cells).length > 0 && (
            <div className="mt-8 border-t border-stone-200 pt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-stone-800">Chart</h2>
              </div>
              <TrackChart 
                chart={project.chart} 
                currentRow={project.counters[0]?.value || 0} 
                isPiP={isPiP} 
                setIsPiP={setIsPiP} 
                onUpdateChart={(updates) => onUpdate({ ...project, chart: { ...project.chart!, ...updates } })}
              />
            </div>
          )}

          {/* Notes Section */}
          <div className="mt-8 border-t border-stone-200 pt-8 pb-8">
            <h2 className="text-lg font-semibold text-stone-800 mb-4">Project Notes</h2>
            <textarea
              value={project.notes || ''}
              onChange={(e) => onUpdate({ ...project, notes: e.target.value })}
              placeholder="Yarn, needles, gauge, modifications..."
              className="w-full h-32 p-3 rounded-xl border border-stone-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-stone-500 resize-y bg-white"
            />
          </div>
        </div>

        {/* PDF Section */}
        {showPdf && pdfFile && activeTab === 'track' && (
          <div className="flex-1 bg-stone-200/50 overflow-hidden flex flex-col relative">
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <label className="bg-white/90 backdrop-blur shadow-sm border border-stone-200 text-stone-700 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer hover:bg-white transition-colors">
                Replace PDF
                <input type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} />
              </label>
              <button 
                onClick={handleRemovePdf}
                className="bg-white/90 backdrop-blur shadow-sm border border-stone-200 text-red-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
              >
                Remove
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 flex justify-center">
              <Document
                file={pdfFile}
                onLoadSuccess={onDocumentLoadSuccess}
                className="max-w-full"
                loading={<div className="p-8 text-stone-500">Loading PDF...</div>}
              >
                <Page 
                  pageNumber={pageNumber} 
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="shadow-lg rounded-sm overflow-hidden"
                  width={Math.min(window.innerWidth - 32, 800)}
                />
              </Document>
            </div>

            {numPages && (
              <div className="bg-white border-t border-stone-200 p-3 flex items-center justify-center gap-4 shrink-0">
                <button
                  disabled={pageNumber <= 1}
                  onClick={() => setPageNumber(p => p - 1)}
                  className="p-2 rounded-lg hover:bg-stone-100 disabled:opacity-50 transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-sm font-medium text-stone-600">
                  Page {pageNumber} of {numPages}
                </span>
                <button
                  disabled={pageNumber >= numPages}
                  onClick={() => setPageNumber(p => p + 1)}
                  className="p-2 rounded-lg hover:bg-stone-100 disabled:opacity-50 transition-colors"
                >
                  <ChevronLeft size={20} className="rotate-180" />
                </button>
              </div>
            )}
            
            {/* Mobile Counters Overlay Toggle */}
            <div className="md:hidden absolute bottom-20 right-4 z-10">
               <button 
                 onClick={() => setShowPdf(false)}
                 className="bg-stone-800 text-white p-4 rounded-full shadow-lg"
               >
                 <Plus size={24} />
               </button>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
