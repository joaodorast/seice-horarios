/** Tamanho final das fotos: suficiente para nitidez em telas de alta densidade, leve para o banco (~20 KB). */
const AVATAR_SIZE = 320;
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

export class ImageError extends Error {}

/**
 * Prepara a foto de perfil no próprio navegador: recorta um quadrado centralizado, reduz para 320×320
 * e comprime (WebP, ou JPEG em navegadores sem WebP). Retorna um data URL pronto para enviar.
 */
export async function prepareAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new ImageError('Escolha um arquivo de imagem (foto JPG, PNG ou WEBP).');
  if (file.size > MAX_INPUT_BYTES) throw new ImageError('A imagem tem mais de 15 MB. Escolha uma foto menor.');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageError('Não foi possível abrir esta imagem. Tente outra foto (JPG ou PNG).');
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageError('Seu navegador não conseguiu processar a imagem.');
  ctx.imageSmoothingQuality = 'high';
  // Retratos costumam ter o rosto na parte de cima: o recorte vertical fica um pouco acima do centro.
  const sx = (bitmap.width - side) / 2;
  const sy = Math.max(0, (bitmap.height - side) * 0.3);
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();

  const webp = canvas.toDataURL('image/webp', 0.85);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85);
}

/** Endereço da foto do professor; muda a cada troca, para o navegador não mostrar a versão antiga. */
export function teacherPhotoUrl(teacher: { id: number; photoUpdatedAt: string | null }): string | undefined {
  return teacher.photoUpdatedAt ? `/api/teachers/${teacher.id}/photo?v=${encodeURIComponent(teacher.photoUpdatedAt)}` : undefined;
}
