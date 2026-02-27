'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  MoreVertical,
  Trash2,
  Pencil,
  Video,
  Clock,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
/* eslint-disable @typescript-eslint/no-explicit-any */

interface ProjectListProps {
  initialProjects: any[];
  userId: string;
}

export function ProjectList({ initialProjects, userId }: ProjectListProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    setIsCreating(true);

    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: userId,
          name: newProjectName.trim(),
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setProjects([data, ...projects]);
        setShowNewModal(false);
        setNewProjectName('');
        router.push(`/editor/${data.id}`);
      }
    } catch (err) {
      console.error('Error creating project:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const deleteProject = async (id: string) => {
    try {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
      setProjects(projects.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Error deleting project:', err);
    }
    setMenuOpenId(null);
  };

  const renameProject = async (id: string) => {
    if (!editName.trim()) return;

    try {
      const { error } = await supabase
        .from('projects')
        .update({ name: editName.trim() })
        .eq('id', id);

      if (error) throw error;
      setProjects(
        projects.map((p) =>
          p.id === id ? { ...p, name: editName.trim() } : p
        )
      );
    } catch (err) {
      console.error('Error renaming project:', err);
    }
    setEditingId(null);
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* New Project Card */}
        <button
          onClick={() => setShowNewModal(true)}
          className="group flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-default/60 hover:border-accent-primary/30 bg-bg-secondary/30 hover:bg-bg-secondary p-8 transition-all min-h-[200px]"
        >
          <div className="w-10 h-10 rounded-md bg-bg-surface flex items-center justify-center border border-border-default/60 group-hover:border-accent-primary/20 transition-colors">
            <Plus size={20} className="text-text-muted group-hover:text-accent-primary transition-colors" />
          </div>
          <span className="text-sm text-text-muted group-hover:text-text-secondary transition-colors">
            Novo Projeto
          </span>
        </button>

        {/* Project Cards */}
        {projects.map((project) => (
          <div
            key={project.id}
            className="group relative flex flex-col rounded-lg border border-border-default/60 bg-bg-secondary hover:border-border-default transition-colors overflow-hidden"
          >
            {/* Thumbnail */}
            <button
              onClick={() => router.push(`/editor/${project.id}`)}
              className="relative aspect-video bg-bg-primary flex items-center justify-center"
            >
              {project.thumbnail_url ? (
                <img
                  src={project.thumbnail_url}
                  alt={project.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Video size={28} className="text-text-muted/40" />
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            </button>

            {/* Info */}
            <div className="p-3 flex-1 flex flex-col">
              {editingId === project.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    renameProject(project.id);
                  }}
                  className="flex gap-2"
                >
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 bg-bg-primary/50 rounded-md px-2 py-1 text-sm border border-border-default/60 focus:border-accent-primary/40 text-text-primary"
                    autoFocus
                    onBlur={() => setEditingId(null)}
                  />
                </form>
              ) : (
                <h3 className="text-sm font-medium truncate text-text-primary">
                  {project.name}
                </h3>
              )}
              <div className="flex items-center gap-1 mt-1.5 text-xs text-text-muted">
                <Clock size={11} />
                {formatDate(project.updated_at)}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-bg-surface text-text-muted border border-border-default/40">
                  {project.aspect_ratio}
                </span>

                {/* Menu */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(
                        menuOpenId === project.id ? null : project.id
                      );
                    }}
                    className="p-1 rounded-md hover:bg-bg-hover transition-colors text-text-muted hover:text-text-secondary"
                  >
                    <MoreVertical size={14} />
                  </button>

                  {menuOpenId === project.id && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setMenuOpenId(null)}
                      />
                      <div className="absolute right-0 bottom-full mb-1 w-36 rounded-md border border-border-default/60 bg-bg-secondary z-50">
                        <button
                          onClick={() => {
                            setEditingId(project.id);
                            setEditName(project.name);
                            setMenuOpenId(null);
                          }}
                          className="w-full flex items-center gap-2 rounded-t-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
                        >
                          <Pencil size={13} />
                          Renomear
                        </button>
                        <button
                          onClick={() => deleteProject(project.id)}
                          className="w-full flex items-center gap-2 rounded-b-md px-3 py-2 text-sm text-accent-danger hover:bg-bg-hover transition-colors"
                        >
                          <Trash2 size={13} />
                          Excluir
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* New Project Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Novo Projeto"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createProject();
          }}
          className="space-y-4"
        >
          <Input
            id="projectName"
            label="Nome do projeto"
            placeholder="Meu vídeo incrível"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            autoFocus
            required
          />
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              onClick={() => setShowNewModal(false)}
              type="button"
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={isCreating}>
              Criar Projeto
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
