import { useRef, useState } from 'react';
import { Camera, ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { Button, ConfirmDialog, Modal, Spinner, useToast } from '@/components/ui';
import { useRemoveTeacherPhoto, useSetTeacherPhoto } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { ImageError, prepareAvatar, teacherPhotoUrl } from '@/lib/image';
import { initials } from '@/lib/text';
import { cn } from '@/lib/cn';
import type { Teacher } from '@shared/types';

/**
 * Foto do professor com as ações de adicionar, trocar e remover.
 * Clicar na foto (ou em "Adicionar foto") abre a escolha do arquivo; antes de salvar, mostra uma prévia.
 */
export function TeacherPhotoField({ teacher, layout = 'stacked' }: { teacher: Teacher; layout?: 'stacked' | 'inline' }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const save = useSetTeacherPhoto();
  const remove = useRemoveTeacherPhoto();
  const toast = useToast();
  const photo = teacherPhotoUrl(teacher);

  async function onFile(file: File) {
    setPreparing(true);
    try {
      setPreview(await prepareAvatar(file));
    } catch (error) {
      toast.error('Não foi possível usar esta imagem', error instanceof ImageError ? error.message : 'Tente outra foto.');
    } finally {
      setPreparing(false);
    }
  }

  async function confirmSave() {
    if (!preview) return;
    try {
      await save.mutateAsync({ id: teacher.id, dataUrl: preview });
      toast.success('Foto salva', teacher.name);
      setPreview(null);
    } catch (error) {
      toast.error('Não foi possível salvar a foto', errorMessage(error));
    }
  }

  async function confirmRemove() {
    try {
      await remove.mutateAsync(teacher.id);
      toast.success('Foto removida', teacher.name);
      setRemoving(false);
    } catch (error) {
      toast.error('Não foi possível remover a foto', errorMessage(error));
    }
  }

  const pick = () => input.current?.click();

  return (
    <div className={cn('flex items-center gap-4', layout === 'stacked' && 'flex-col text-center')}>
      <button
        type="button"
        onClick={pick}
        aria-label={photo ? `Trocar a foto de ${teacher.name}` : `Adicionar foto de ${teacher.name}`}
        title={photo ? 'Trocar foto' : 'Adicionar foto'}
        className="group relative size-24 shrink-0 overflow-hidden rounded-full ring-4 ring-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {photo ? (
          <img src={photo} alt="" width={96} height={96} className="size-full object-cover" />
        ) : (
          <span className={cn('grid size-full place-items-center text-2xl font-extrabold', teacher.active ? 'bg-nav text-brand' : 'bg-ink/[0.06] text-muted')}>
            {initials(teacher.name)}
          </span>
        )}
        <span className="absolute inset-0 grid place-items-center bg-ink/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {preparing ? <Spinner size={22} /> : <Camera className="size-6" />}
        </span>
      </button>

      <div className={cn('flex flex-wrap gap-2', layout === 'stacked' && 'justify-center')}>
        <Button size="sm" icon={photo ? <RefreshCw className="size-4" /> : <ImagePlus className="size-4" />} onClick={pick} loading={preparing}>
          {photo ? 'Trocar foto' : 'Adicionar foto'}
        </Button>
        {photo && (
          <Button size="sm" variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setRemoving(true)}>
            Remover
          </Button>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void onFile(file);
        }}
      />

      <Modal
        open={preview !== null}
        onClose={() => setPreview(null)}
        size="sm"
        title="Confirmar foto"
        description="Assim a foto vai aparecer nas listas e na página do professor."
      >
        {preview && (
          <div className="flex flex-col items-center gap-5">
            <div className="flex items-end gap-5">
              <img src={preview} alt="Prévia da foto" width={128} height={128} className="size-32 rounded-full object-cover shadow-raise ring-4 ring-brand-soft" />
              <img src={preview} alt="" width={36} height={36} className="mb-2 size-9 rounded-full object-cover" />
            </div>
            <p className="text-center text-sm text-muted">A imagem foi recortada no centro e reduzida para carregar rápido.</p>
            <div className="-mx-5 -mb-5 flex w-[calc(100%+2.5rem)] flex-col-reverse gap-2 border-t border-line bg-subtle px-5 py-3.5 sm:-mx-6 sm:w-[calc(100%+3rem)] sm:flex-row sm:justify-end sm:px-6">
              <Button onClick={pick}>Escolher outra</Button>
              <Button variant="primary" loading={save.isPending} onClick={() => void confirmSave()}>
                Salvar foto
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={removing}
        title="Remover a foto?"
        confirmLabel="Remover foto"
        loading={remove.isPending}
        onClose={() => setRemoving(false)}
        onConfirm={() => void confirmRemove()}
      >
        <p>As iniciais de {teacher.name} voltam a aparecer no lugar da foto. Você pode adicionar outra quando quiser.</p>
      </ConfirmDialog>
    </div>
  );
}
